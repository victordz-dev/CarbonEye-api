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
    evi_atual?: number;
    ndwi_atual?: number;
    umidade_solo?: number;
    temp_solo?: number;
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
      const ndviData = await this.integrationsService.obterHistoricoNdvi(polyId);
      
      // Filtra outliers (valores < 0.1) e extrai apenas os números para o cálculo SIRI
      const ndviHistory = ndviData
        .map((item) => item.valor)
        .filter((valor) => valor >= 0.1);

      const ndviAtual =
        ndviHistory.length > 0 ? ndviHistory[ndviHistory.length - 1] : 0.75;

      const indicesExtra = await this.integrationsService.obterIndicesRecentes(polyId);

      let notaVegetacao = 0;
      // Melhora a nota da vegetação combinando NDVI e EVI se o EVI for forte
      const saudeMax = Math.max(ndviAtual, indicesExtra.evi);
      if (saudeMax >= 0.8) {
        notaVegetacao = 45;
      } else if (saudeMax >= 0.7) {
        notaVegetacao = 40;
      } else if (saudeMax >= 0.6) {
        notaVegetacao = 35;
      } else if (saudeMax >= 0.5) {
        notaVegetacao = 25;
      } else if (saudeMax >= 0.4) {
        notaVegetacao = 15;
      } else {
        notaVegetacao = 0;
      }

      // Se NDWI (Água na folha) for muito baixo, penaliza a nota de vegetação (-5 pts)
      if (indicesExtra.ndwi < -0.1) {
        notaVegetacao = Math.max(0, notaVegetacao - 5);
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
      const dadosSolo = await this.integrationsService.obterDadosSolo(polyId);

      // Usando Umidade do Solo (moisture m3/m3) para ajudar na nota
      // Se umidade do solo > 0.15 e temp < 30, é ótimo.
      // Se umidade do solo < 0.05 ou temp > 35, muito ruim.
      if (clima.umidade > 40 && clima.temp < 30 && clima.vento < 15 && dadosSolo.umidade >= 0.1) {
        notaClima = 5; // Baixo Risco
      } else if (clima.umidade < 20 || clima.temp > 35 || clima.vento > 30 || dadosSolo.umidade < 0.05) {
        notaClima = 0; // Alto Risco
      }

      let pontuacaoTotal =
        notaVegetacao + notaHistorico + notaIncendios + notaClima;

      // Penalidade para áreas severamente degradadas ou urbanizadas
      if (ndviAtual < 0.25) {
        pontuacaoTotal = Math.min(pontuacaoTotal, 35);
      }

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
          evi_atual: indicesExtra.evi,
          ndwi_atual: indicesExtra.ndwi,
          umidade_solo: dadosSolo.umidade,
          temp_solo: dadosSolo.tempSuperficie,
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
