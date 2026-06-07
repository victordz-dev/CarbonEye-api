import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { Coordenada } from '../geo/geo.service';

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
  mean: number;
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
  image: {
    ndvi: string;
    truecolor: string;
  };
}

@Injectable()
export class IntegrationsService {
  private readonly logger = new Logger(IntegrationsService.name);

  private readonly agroApiKey: string;
  private readonly firmsMapKey: string;
  private readonly weatherApiKey: string;

  constructor(private readonly configService: ConfigService) {
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
      if (formattedCoords[0] !== formattedCoords[formattedCoords.length - 1]) {
        formattedCoords.push(formattedCoords[0]);
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
      );
      return response.data.id;
    } catch (error) {
      this.logger.error(
        `Erro ao criar polígono no AgroMonitoring: ${(error as Error).message}`,
      );
      throw new Error('Falha na integração com AgroMonitoring.');
    }
  }

  /**
   * Obtém a lista de médias de NDVI para os últimos 12 meses
   */
  async obterHistoricoNdvi(polyId: string): Promise<number[]> {
    try {
      const end = Math.floor(Date.now() / 1000);
      const start = end - 365 * 24 * 60 * 60; // 12 meses

      const response = await axios.get<AgroNdviItem[]>(
        `http://api.agromonitoring.com/agro/1.0/ndvi/history?polyid=${polyId}&start=${start}&end=${end}&appid=${this.agroApiKey}`,
      );

      if (Array.isArray(response.data)) {
        return response.data.map((item: AgroNdviItem) => item.mean);
      }
      return [];
    } catch (error) {
      this.logger.error(
        `Erro ao buscar histórico de NDVI: ${(error as Error).message}`,
      );
      return [
        0.75, 0.76, 0.78, 0.8, 0.82, 0.81, 0.79, 0.75, 0.72, 0.74, 0.76, 0.77,
      ];
    }
  }

  /**
   * Obtém a URL da imagem orbital NDVI mais recente
   */
  async obterImagemSateliteRecente(polyId: string): Promise<string> {
    try {
      const end = Math.floor(Date.now() / 1000);
      const start = end - 30 * 24 * 60 * 60; // 30 dias

      const response = await axios.get<AgroImageItem[]>(
        `http://api.agromonitoring.com/agro/1.0/image/search?polyid=${polyId}&start=${start}&end=${end}&appid=${this.agroApiKey}`,
      );

      if (response.data && response.data.length > 0) {
        return response.data[0].image.ndvi;
      }
      return 'https://picsum.photos/id/10/400/300';
    } catch (error) {
      this.logger.error(
        `Erro ao obter imagem orbital: ${(error as Error).message}`,
      );
      return 'https://picsum.photos/id/10/400/300';
    }
  }

  /**
   * Obtém as condições climáticas atuais para uma coordenada central do polígono
   */
  async obterClimaAtual(
    latitude: number,
    longitude: number,
  ): Promise<WeatherData> {
    try {
      const response = await axios.get<OpenWeatherResponse>(
        `https://api.openweathermap.org/data/2.5/weather?lat=${latitude}&lon=${longitude}&appid=${this.weatherApiKey}&units=metric`,
      );

      const data = response.data;
      return {
        temp: data.main.temp,
        umidade: data.main.humidity,
        vento: data.wind.speed * 3.6, // m/s para km/h
      };
    } catch (error) {
      this.logger.error(`Erro ao buscar clima: ${(error as Error).message}`);
      return { temp: 24.5, umidade: 55, vento: 12 };
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
