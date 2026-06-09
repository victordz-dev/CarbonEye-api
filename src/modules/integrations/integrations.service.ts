import { Injectable, Logger, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import type { Coordenada } from '../geo/geo.types';
import { LogsService } from '../logs/logs.service';
import { NivelLog, OrigemLog } from '../../entities/sistemalog.entity';
import { HttpException, HttpStatus } from '@nestjs/common';

export interface WeatherData {
  temp: number;
  umidade: number;
  vento: number;
}

export interface FocoCalor {
  latitude: number;
  longitude: number;
  data: Date;
}

interface AgroNdviItem {
  dt: number;
  data: {
    mean: number;
  };
}

interface OpenWeatherResponse {
  main: {
    temp: number;
    humidity: number;
  };
  wind: {
    speed: number;
  };
}

interface AgroImageItem {
  cl: number;
  image: {
    ndvi: string;
    truecolor: string;
  };
  stats?: {
    evi: string;
    ndwi: string;
    ndvi: string;
  };
}

@Injectable()
export class IntegrationsService {
  private readonly logger = new Logger(IntegrationsService.name);

  private readonly agroApiKey: string;
  private readonly firmsMapKey: string;
  private readonly weatherApiKey: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly logsService: LogsService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {
    this.agroApiKey = this.configService.get<string>(
      'AGROMONITORING_API_KEY',
      '',
    );
    this.firmsMapKey = this.configService.get<string>('NASA_FIRMS_MAP_KEY', '');
    this.weatherApiKey = this.configService.get<string>(
      'OPENWEATHER_API_KEY',
      '',
    );
  }

  /**
   * Registra o polígono no AgroMonitoring e retorna o ID gerado
   */
  async criarPoligono(coords: Coordenada[], nome: string): Promise<string> {
    try {
      const formattedCoords = coords.map((c) => [c.longitude, c.latitude]);

      // Corrigindo o bug: validando os valores reais e não as referências de memória
      const primeiroPonto = formattedCoords[0];
      const ultimoPonto = formattedCoords[formattedCoords.length - 1];

      if (
        primeiroPonto[0] !== ultimoPonto[0] ||
        primeiroPonto[1] !== ultimoPonto[1]
      ) {
        formattedCoords.push(primeiroPonto);
      }

      const response = await axios.post<{ id: string }>(
        `http://api.agromonitoring.com/agro/1.0/polygons?appid=${this.agroApiKey}`,
        {
          name: nome,
          geo_json: {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'Polygon',
              coordinates: [formattedCoords],
            },
          },
        },
        { timeout: 15000 }, // 15s timeout
      );
      return response.data.id;
    } catch (error: unknown) {
      const detalhesErro = axios.isAxiosError(error) ? error.response?.data : (error instanceof Error ? error.message : 'Unknown error');

      this.logger.error(
        `Erro ao criar polígono no AgroMonitoring: ${JSON.stringify(detalhesErro)}`,
      );

      await this.logsService.registrarLog({
        acao: 'Falha de Integração: AgroMonitoring (Criar Polígono)',
        nivel: NivelLog.ERROR,
        origem: OrigemLog.BACKEND,
        detalhes: { error: detalhesErro, payload: { nome } },
      });

      throw new HttpException(
        `INTEGRATION_ERROR: Falha na integração com AgroMonitoring.`,
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  /**
   * Exclui um polígono na API do AgroMonitoring
   */
  async deletarPoligono(polyId: string): Promise<void> {
    try {
      await axios.delete(
        `http://api.agromonitoring.com/agro/1.0/polygons/${polyId}?appid=${this.agroApiKey}`,
        { timeout: 30000 },
      );
      this.logger.log(
        `Polígono ${polyId} excluído com sucesso do AgroMonitoring.`,
      );
    } catch (error) {
      this.logger.error(
        `Erro ao excluir polígono ${polyId} no AgroMonitoring: ${(error as Error).message}`,
      );
      // Não lançamos erro aqui para não travar a exclusão local caso a API deles falhe ou o ID não exista mais
    }
  }

  /**
   * Obtém a lista de todos os polígonos na conta do AgroMonitoring
   */
  async obterTodosPoligonos(): Promise<{ id: string; created_at: number }[]> {
    try {
      const response = await axios.get(
        `http://api.agromonitoring.com/agro/1.0/polygons?appid=${this.agroApiKey}`,
        { timeout: 30000 },
      );
      if (Array.isArray(response.data)) {
        return response.data.map((poly: { id: string; created_at: number }) => ({
          id: poly.id,
          created_at: poly.created_at,
        }));
      }
      return [];
    } catch (error) {
      this.logger.error(
        `Erro ao obter lista de polígonos: ${(error as Error).message}`,
      );
      return [];
    }
  }

  /**
   * Obtém a lista de médias de NDVI para o último ano (12 meses)
   */
  async obterHistoricoNdvi(
    polyId: string,
  ): Promise<{ dataUnix: number; valor: number }[]> {
    try {
      const cacheKey = `ndvi_history_${polyId}`;
      const cached = await this.cacheManager.get<{ dataUnix: number; valor: number }[]>(cacheKey);
      if (cached) return cached;

      const end = Math.floor(Date.now() / 1000);
      const start = end - 365 * 24 * 60 * 60; // 1 ano

      const response = await axios.get<AgroNdviItem[]>(
        `http://api.agromonitoring.com/agro/1.0/ndvi/history?polyid=${polyId}&start=${start}&end=${end}&appid=${this.agroApiKey}`,
        { timeout: 90000 }, // Aumentado para 90s para dar tempo ao satélite calcular áreas grandes (sem estourar os 120s do frontend)
      );

      if (Array.isArray(response.data)) {
        response.data.sort((a: AgroNdviItem, b: AgroNdviItem) => a.dt - b.dt);
        const result = response.data.map((item: AgroNdviItem) => ({
          dataUnix: item.dt,
          valor: item.data?.mean || 0,
        }));
        await this.cacheManager.set(cacheKey, result, 3600000);
        return result;
      }
      return [];
    } catch (error) {
      this.logger.error(
        `Erro ao buscar histórico de NDVI: ${(error as Error).message}`,
      );
      throw new Error(
        `O satélite não conseguiu processar o histórico dessa área a tempo. A área pode ser muito grande ou a rede está lenta.`,
      );
    }
  }

  /**
   * Obtém dados atuais de umidade e temperatura do solo.
   * Retorna null em caso de falha na API.
   */
  async obterDadosSolo(
    polyId: string,
  ): Promise<{ umidade: number; tempSuperficie: number } | null> {
    try {
      const response = await axios.get<{ moisture: number; t0: number }>(
        `http://api.agromonitoring.com/agro/1.0/soil?polyid=${polyId}&appid=${this.agroApiKey}`,
        { timeout: 5000 },
      );

      if (response.data) {
        // t0 está em Kelvin. Convertendo para Celsius.
        return {
          umidade: response.data.moisture,
          tempSuperficie: response.data.t0 - 273.15,
        };
      }
      return null;
    } catch (error) {
      this.logger.error(
        `Erro ao obter dados de solo: ${(error as Error).message}`,
      );
      return null;
    }
  }

  /**
   * Obtém os índices recentes EVI e NDWI da última passagem do satélite.
   * Retorna null em caso de falha na API.
   */
  async obterIndicesRecentes(
    polyId: string,
  ): Promise<{ evi: number; ndwi: number } | null> {
    try {
      const cacheKey = `indices_recentes_${polyId}`;
      const cached = await this.cacheManager.get<{ evi: number; ndwi: number }>(cacheKey);
      if (cached) return cached;

      const end = Math.floor(Date.now() / 1000);
      const start = end - 30 * 24 * 60 * 60; // 30 dias

      const response = await axios.get<AgroImageItem[]>(
        `http://api.agromonitoring.com/agro/1.0/image/search?polyid=${polyId}&start=${start}&end=${end}&appid=${this.agroApiKey}`,
        { timeout: 8000 },
      );

      if (response.data && response.data.length > 0 && response.data[0].stats) {
        const stats = response.data[0].stats;

        const [eviRes, ndwiRes] = await Promise.all([
          axios
            .get<{ mean: number }>(stats.evi, { timeout: 5000 })
            .catch(() => ({ data: { mean: 0 } })),
          axios
            .get<{ mean: number }>(stats.ndwi, { timeout: 5000 })
            .catch(() => ({ data: { mean: 0 } })),
        ]);

        const result = {
          evi: eviRes.data.mean,
          ndwi: ndwiRes.data.mean,
        };
        await this.cacheManager.set(cacheKey, result, 3600000);
        return result;
      }
      return null;
    } catch (error) {
      this.logger.error(
        `Erro ao obter índices EVI/NDWI recentes: ${(error as Error).message}`,
      );
      return null;
    }
  }

  /**
   * Obtém as condições climáticas atuais para uma coordenada central do polígono.
   * Retorna null em caso de falha na API.
   */
  async obterClimaAtual(
    latitude: number,
    longitude: number,
  ): Promise<WeatherData | null> {
    try {
      const response = await axios.get<OpenWeatherResponse>(
        `https://api.openweathermap.org/data/2.5/weather?lat=${latitude}&lon=${longitude}&appid=${this.weatherApiKey}&units=metric`,
        { timeout: 5000 },
      );

      const data = response.data;
      return {
        temp: data.main.temp,
        umidade: data.main.humidity,
        vento: data.wind.speed * 3.6, // m/s para km/h
      };
    } catch (error) {
      this.logger.error(`Erro ao buscar clima: ${(error as Error).message}`);
      return null;
    }
  }

  /**
   * Obtém focos ativos recentes de queimadas detectadas nas últimas 24h na Bounding Box com buffer
   */
  async obterFocosAtivosRecentes(coords: Coordenada[]): Promise<FocoCalor[]> {
    try {
      const lats = coords.map((c) => c.latitude);
      const lons = coords.map((c) => c.longitude);
      const minLat = Math.min(...lats) - 0.09;
      const minLon = Math.min(...lons) - 0.09;
      const maxLat = Math.max(...lats) + 0.09;
      const maxLon = Math.max(...lons) + 0.09;

      const bboxStr = `${minLon},${minLat},${maxLon},${maxLat}`;
      const response = await axios.get<string>(
        `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${this.firmsMapKey}/VIIRS_SNPP_NRT/${bboxStr}/1`,
        { timeout: 8000 },
      );

      const lines = response.data.split('\n');
      if (lines.length <= 1) return [];

      const headers = lines[0].split(',');
      const latIdx = headers.indexOf('latitude');
      const lonIdx = headers.indexOf('longitude');
      const dateIdx = headers.indexOf('acq_date');
      const timeIdx = headers.indexOf('acq_time');

      if (latIdx === -1 || lonIdx === -1 || dateIdx === -1 || timeIdx === -1) {
        return [];
      }

      const results: FocoCalor[] = [];
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const columns = line.split(',');
        if (columns.length <= Math.max(latIdx, lonIdx, dateIdx, timeIdx))
          continue;

        const lat = parseFloat(columns[latIdx]);
        const lon = parseFloat(columns[lonIdx]);
        const dateStr = columns[dateIdx];
        const timeStr = columns[timeIdx];

        const hour = timeStr.padStart(4, '0').substring(0, 2);
        const minute = timeStr.padStart(4, '0').substring(2, 4);
        const date = new Date(`${dateStr}T${hour}:${minute}:00Z`);

        results.push({
          latitude: lat,
          longitude: lon,
          data: date,
        });
      }
      return results;
    } catch (error) {
      this.logger.error(
        `Erro ao buscar focos ativos do NASA FIRMS: ${(error as Error).message}`,
      );
      return [];
    }
  }
}
