import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { TerritorioProtegido } from '../../entities/territorioprotegido.entity';
import { FocoIncendio } from '../../entities/focoincendio.entity';
import axios from 'axios';
import type { Coordenada } from './geo.types';
import {
  coordenadasParaWktPolygon,
  obterCentroide,
  isDentroDoBrasil,
} from './geo.utils';

// Re-exportar types e utils para manter compatibilidade de imports existentes
export type { Coordenada } from './geo.types';
export { coordenadasParaWktPolygon, obterCentroide } from './geo.utils';

@Injectable()
export class GeoService {
  private readonly logger = new Logger(GeoService.name);

  constructor(
    @InjectRepository(TerritorioProtegido)
    private readonly territorioRepository: Repository<TerritorioProtegido>,
    @InjectRepository(FocoIncendio)
    private readonly focoRepository: Repository<FocoIncendio>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Verifica se a área fornecida intersecta alguma Terra Indígena (TI) ou Unidade de Conservação (UC)
   */
  async verificarSobreposicao(
    coords: Coordenada[],
  ): Promise<{ intercepta: boolean; nomeReserva?: string; tipo?: string }> {
    try {
      const wkt = coordenadasParaWktPolygon(coords);
      const query = `
        SELECT nome_reserva, tipo
        FROM territorios_protegidos
        WHERE ST_Intersects(geom, ST_GeomFromText($1, 4326))
        LIMIT 1
      `;
      const result = (await this.territorioRepository.query(query, [
        wkt,
      ])) as unknown as { nome_reserva: string; tipo: string }[];
      if (result && result.length > 0) {
        return {
          intercepta: true,
          nomeReserva: result[0].nome_reserva,
          tipo: result[0].tipo,
        };
      }
      return { intercepta: false };
    } catch (error) {
      throw new Error(
        `Erro na validação espacial PostGIS: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Conta os focos de incêndio no raio de 10km do polígono nos últimos X meses
   */
  async obterQuantidadeFocosNoEntorno(
    coords: Coordenada[],
    meses: number = 12,
  ): Promise<number> {
    try {
      const wkt = coordenadasParaWktPolygon(coords);
      const dataLimite = new Date();
      dataLimite.setMonth(dataLimite.getMonth() - meses);

      const query = `
        SELECT COUNT(*) as total
        FROM focos_incendio f
        WHERE ST_DWithin(f.geometria, ST_GeomFromText($1, 4326), 0.09)
          AND f.data >= $2
      `;
      const result = (await this.focoRepository.query(query, [
        wkt,
        dataLimite,
      ])) as unknown as { total: string }[];
      return result && result[0] ? parseInt(result[0].total, 10) : 0;
    } catch (error) {
      throw new Error(
        `Erro na busca de queimadas no entorno: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Calcula a área em metros quadrados de um polígono WKT usando PostGIS.
   */
  async calcularAreaM2(wkt: string): Promise<number> {
    const result = (await this.dataSource.query(
      'SELECT ST_Area(ST_GeomFromText($1, 4326)::geography) as area_m2',
      [wkt],
    )) as { area_m2: string }[];
    return parseFloat(result[0].area_m2);
  }

  /**
   * Calcula a área total (m²) de todas as áreas com monitoramento ativo de um usuário.
   */
  async calcularAreaTotalUsuarioM2(usuarioId: string): Promise<number> {
    const result = (await this.dataSource.query(
      'SELECT SUM(ST_Area(geometria::geography)) as total_m2 FROM areas WHERE usuario_id = $1 AND monitoramento_ativo = true',
      [usuarioId],
    )) as { total_m2: string | null }[];
    return parseFloat(result[0]?.total_m2 || '0');
  }

  /**
   * Extrai as coordenadas de uma área salva no banco a partir do seu GeoJSON.
   */
  async extrairCoordenadasDaArea(areaId: string): Promise<Coordenada[]> {
    const result = (await this.dataSource.query(
      'SELECT ST_AsGeoJSON(geometria) as geojson FROM areas WHERE id = $1',
      [areaId],
    )) as { geojson: string }[];

    if (!result?.[0]?.geojson) {
      throw new NotFoundException(
        'Geometria não encontrada para a área informada.',
      );
    }

    const geojson = JSON.parse(result[0].geojson) as {
      coordinates: number[][][];
    };
    return geojson.coordinates[0].map((pt: number[]) => ({
      longitude: pt[0],
      latitude: pt[1],
    }));
  }

  /**
   * Valida se as coordenadas estão dentro do Brasil consultando a API do Nominatim.
   * Verifica primeiro pela bounding box e depois por reverse geocoding do centroide.
   */
  async isExatamenteNoBrasil(coords: Coordenada[]): Promise<boolean> {
    if (!isDentroDoBrasil(coords)) {
      return false;
    }

    try {
      const centroide = obterCentroide(coords);

      const res = await axios.get(
        `https://nominatim.openstreetmap.org/reverse?lat=${centroide.latitude}&lon=${centroide.longitude}&format=json`,
        { headers: { 'User-Agent': 'CarbonEye-TCC-App/1.0' } },
      );

      const countryCode = res.data?.address?.country_code;
      return countryCode === 'br';
    } catch (error) {
      this.logger.warn(
        `Falha ao validar país no Nominatim: ${(error as Error).message}. Assumindo válido.`,
      );
      return true;
    }
  }
}
