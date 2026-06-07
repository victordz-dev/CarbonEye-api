import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TerritorioProtegido } from '../../entities/territorioprotegido.entity';
import { FocoIncendio } from '../../entities/focoincendio.entity';

export interface Coordenada {
  latitude: number;
  longitude: number;
}

export function coordenadasParaWktPolygon(coords: Coordenada[]): string {
  if (coords.length < 3) {
    throw new Error('Um polígono necessita de pelo menos 3 pontos.');
  }
  const pontos = coords.map((c) => `${c.longitude} ${c.latitude}`);
  // Garante que o polígono esteja fechado para o PostGIS
  if (pontos[0] !== pontos[pontos.length - 1]) {
    pontos.push(pontos[0]);
  }
  return `POLYGON((${pontos.join(', ')}))`;
}

@Injectable()
export class GeoService {
  constructor(
    @InjectRepository(TerritorioProtegido)
    private readonly territorioRepository: Repository<TerritorioProtegido>,
    @InjectRepository(FocoIncendio)
    private readonly focoRepository: Repository<FocoIncendio>,
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
        WHERE ST_DWithin(f.geometria::geography, ST_GeomFromText($1, 4326)::geography, 10000)
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
}
