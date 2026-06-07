import { Injectable, Logger } from '@nestjs/common';
import { GeoService, Coordenada } from '../geo/geo.service';
import {
  IntegrationsService,
  WeatherData,
} from '../integrations/integrations.service';

export interface SiriScoreResult {
  pontuacaoTotal: number;
  detalhes: {
    vegetacao: number;
    historico: number;
    incendios: number;
    clima: number;
  };
  climaAtual: WeatherData;
  classificacao: string;
}

export function obterCentroide(coords: Coordenada[]): Coordenada {
  const lats = coords.map((c) => c.latitude);
  const lons = coords.map((c) => c.longitude);
  const avgLat = lats.reduce((sum, val) => sum + val, 0) / coords.length;
  const avgLon = lons.reduce((sum, val) => sum + val, 0) / coords.length;
  return { latitude: avgLat, longitude: avgLon };
}

@Injectable()
export class SiriService {
  private readonly logger = new Logger(SiriService.name);

  constructor(
    private readonly geoService: GeoService,
    private readonly integrationsService: IntegrationsService,
  ) {}

  /**
   * Calcula o índice SIRI (0 a 100) combinando dados orbitais, climáticos e de incêndio.
   */
  async calcularSiri(
    coords: Coordenada[],
    polyId: string,
  ): Promise<SiriScoreResult> {
    try {
      this.logger.log(`Iniciando cálculo do SIRI para o polígono ${polyId}...`);

      // 1. Saúde da Vegetação Atual (max 45 pontos)
      const ndviHistory =
        await this.integrationsService.obterHistoricoNdvi(polyId);
      const ndviAtual =
        ndviHistory.length > 0 ? ndviHistory[ndviHistory.length - 1] : 0.75;

      let notaVegetacao = 0;
      if (ndviAtual >= 0.8) {
        notaVegetacao = 45;
      } else if (ndviAtual >= 0.7) {
        notaVegetacao = 40;
      } else if (ndviAtual >= 0.6) {
        notaVegetacao = 35;
      } else if (ndviAtual >= 0.5) {
        notaVegetacao = 25;
      } else if (ndviAtual >= 0.4) {
        notaVegetacao = 15;
      } else {
        notaVegetacao = 0;
      }

      // 2. Tendência Histórica da Vegetação (max 30 pontos)
      let notaHistorico = 20; // Estabilidade padrão se faltarem dados
      let variacaoPercentual = 0;
      if (ndviHistory.length >= 6) {
        const count = ndviHistory.length;
        const mediaRecente =
          (ndviHistory[count - 1] +
            ndviHistory[count - 2] +
            ndviHistory[count - 3]) /
          3;
        const mediaAntiga =
          (ndviHistory[0] + ndviHistory[1] + ndviHistory[2]) / 3;
        variacaoPercentual =
          ((mediaRecente - mediaAntiga) / (mediaAntiga || 0.1)) * 100;

        if (variacaoPercentual > 10) {
          notaHistorico = 30;
        } else if (variacaoPercentual >= 5) {
          notaHistorico = 25;
        } else if (variacaoPercentual >= -5) {
          notaHistorico = 20;
        } else if (variacaoPercentual >= -10) {
          notaHistorico = 10;
        } else {
          notaHistorico = 0;
        }
      }

      // 3. Histórico de Incêndios (max 20 pontos)
      const focosIncendio = await this.geoService.obterQuantidadeFocosNoEntorno(
        coords,
        12,
      );
      let notaIncendios = 0;
      if (focosIncendio === 0) {
        notaIncendios = 20;
      } else if (focosIncendio <= 3) {
        notaIncendios = 15;
      } else if (focosIncendio <= 10) {
        notaIncendios = 10;
      } else if (focosIncendio <= 20) {
        notaIncendios = 5;
      } else {
        notaIncendios = 0;
      }

      // 4. Fatores Climáticos (max 5 pontos)
      const centroid = obterCentroide(coords);
      const clima = await this.integrationsService.obterClimaAtual(
        centroid.latitude,
        centroid.longitude,
      );

      let notaClima = 3; // Risco Médio padrão
      if (clima.umidade > 40 && clima.temp < 30 && clima.vento < 15) {
        notaClima = 5; // Baixo Risco
      } else if (clima.umidade < 20 || clima.temp > 35 || clima.vento > 30) {
        notaClima = 0; // Alto Risco
      }

      const pontuacaoTotal =
        notaVegetacao + notaHistorico + notaIncendios + notaClima;

      let classificacao =
        'Área com Baixo Risco Ambiental (Potencialmente Classificável)';
      if (pontuacaoTotal < 40) {
        classificacao = 'Área Sob Risco Ambiental';
      } else if (pontuacaoTotal < 70) {
        classificacao = 'Área em Atenção';
      }

      return {
        pontuacaoTotal,
        detalhes: {
          vegetacao: notaVegetacao,
          historico: notaHistorico,
          incendios: notaIncendios,
          clima: notaClima,
        },
        climaAtual: clima,
        classificacao,
      };
    } catch (error) {
      this.logger.error(
        `Erro no cálculo do índice SIRI: ${(error as Error).message}`,
      );
      throw new Error(
        `Falha no cálculo do laudo SIRI: ${(error as Error).message}`,
      );
    }
  }
}
