import { Injectable, Logger } from '@nestjs/common';
import { GeoService, Coordenada } from '../geo/geo.service';
import {
  IntegrationsService,
  WeatherData,
} from '../integrations/integrations.service';
import { SIRI_CONSTANTS } from './siri.constants';

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

      const centroid = obterCentroide(coords);

      // Paraleliza as chamadas a serviços externos
      const [ndviData, indicesExtra, focosIncendio, clima, dadosSolo] = await Promise.all([
        this.integrationsService.obterHistoricoNdvi(polyId),
        this.integrationsService.obterIndicesRecentes(polyId),
        this.geoService.obterQuantidadeFocosNoEntorno(coords, 12),
        this.integrationsService.obterClimaAtual(centroid.latitude, centroid.longitude),
        this.integrationsService.obterDadosSolo(polyId)
      ]);

      // 1. Saúde da Vegetação Atual
      const ndviHistory = ndviData
        .map((item) => item.valor)
        .filter((valor) => valor >= 0.1);

      const ndviAtual =
        ndviHistory.length > 0 ? ndviHistory[ndviHistory.length - 1] : 0.75;

      let notaVegetacao = 0;
      const saudeMax = Math.max(ndviAtual, indicesExtra.evi);
      
      if (saudeMax >= SIRI_CONSTANTS.VEGETACAO_OTIMA) {
        notaVegetacao = SIRI_CONSTANTS.PONTUACAO_VEGETACAO_OTIMA;
      } else if (saudeMax >= SIRI_CONSTANTS.VEGETACAO_BOA) {
        notaVegetacao = SIRI_CONSTANTS.PONTUACAO_VEGETACAO_BOA;
      } else if (saudeMax >= SIRI_CONSTANTS.VEGETACAO_REGULAR) {
        notaVegetacao = SIRI_CONSTANTS.PONTUACAO_VEGETACAO_REGULAR;
      } else if (saudeMax >= SIRI_CONSTANTS.VEGETACAO_ATENCAO) {
        notaVegetacao = SIRI_CONSTANTS.PONTUACAO_VEGETACAO_ATENCAO;
      } else if (saudeMax >= SIRI_CONSTANTS.VEGETACAO_CRITICA) {
        notaVegetacao = SIRI_CONSTANTS.PONTUACAO_VEGETACAO_CRITICA;
      } else {
        notaVegetacao = 0;
      }

      if (indicesExtra.ndwi < SIRI_CONSTANTS.LIMIAR_NDWI_ESTRESSE) {
        notaVegetacao = Math.max(0, notaVegetacao - SIRI_CONSTANTS.PENALIDADE_NDWI);
      }

      // 2. Tendência Histórica da Vegetação
      let notaHistorico = SIRI_CONSTANTS.PONTUACAO_HISTORICO_ESTAVEL;
      let variacaoPercentual = 0;
      
      if (ndviHistory.length >= 6) {
        const count = ndviHistory.length;
        const mediaRecente = (ndviHistory[count - 1] + ndviHistory[count - 2] + ndviHistory[count - 3]) / 3;
        const mediaAntiga = (ndviHistory[0] + ndviHistory[1] + ndviHistory[2]) / 3;
        variacaoPercentual = ((mediaRecente - mediaAntiga) / (mediaAntiga || 0.1)) * 100;

        if (variacaoPercentual > SIRI_CONSTANTS.HISTORICO_CRESCIMENTO_ALTO) {
          notaHistorico = SIRI_CONSTANTS.PONTUACAO_HISTORICO_CRESCIMENTO_ALTO;
        } else if (variacaoPercentual >= SIRI_CONSTANTS.HISTORICO_CRESCIMENTO_MEDIO) {
          notaHistorico = SIRI_CONSTANTS.PONTUACAO_HISTORICO_CRESCIMENTO_MEDIO;
        } else if (variacaoPercentual >= SIRI_CONSTANTS.HISTORICO_QUEDA_MEDIA) {
          notaHistorico = SIRI_CONSTANTS.PONTUACAO_HISTORICO_ESTAVEL;
        } else if (variacaoPercentual >= SIRI_CONSTANTS.HISTORICO_QUEDA_ALTA) {
          notaHistorico = SIRI_CONSTANTS.PONTUACAO_HISTORICO_QUEDA_MEDIA;
        } else {
          notaHistorico = SIRI_CONSTANTS.PONTUACAO_HISTORICO_QUEDA_ALTA;
        }
      }

      // 3. Histórico de Incêndios
      let notaIncendios = 0;
      if (focosIncendio === SIRI_CONSTANTS.INCENDIOS_NENHUM) {
        notaIncendios = SIRI_CONSTANTS.PONTUACAO_INCENDIOS_NENHUM;
      } else if (focosIncendio <= SIRI_CONSTANTS.INCENDIOS_BAIXO) {
        notaIncendios = SIRI_CONSTANTS.PONTUACAO_INCENDIOS_BAIXO;
      } else if (focosIncendio <= SIRI_CONSTANTS.INCENDIOS_MEDIO) {
        notaIncendios = SIRI_CONSTANTS.PONTUACAO_INCENDIOS_MEDIO;
      } else if (focosIncendio <= SIRI_CONSTANTS.INCENDIOS_ALTO) {
        notaIncendios = SIRI_CONSTANTS.PONTUACAO_INCENDIOS_ALTO;
      } else {
        notaIncendios = SIRI_CONSTANTS.PONTUACAO_INCENDIOS_CRITICO;
      }

      // 4. Fatores Climáticos
      let notaClima = SIRI_CONSTANTS.PONTUACAO_CLIMA_MEDIO_RISCO;

      if (
        clima.umidade > SIRI_CONSTANTS.CLIMA_UMIDADE_AR_IDEAL &&
        clima.temp < SIRI_CONSTANTS.CLIMA_TEMP_IDEAL &&
        clima.vento < SIRI_CONSTANTS.CLIMA_VENTO_IDEAL &&
        dadosSolo.umidade >= SIRI_CONSTANTS.SOLO_UMIDADE_IDEAL
      ) {
        notaClima = SIRI_CONSTANTS.PONTUACAO_CLIMA_BAIXO_RISCO;
      } else if (
        clima.umidade < SIRI_CONSTANTS.CLIMA_UMIDADE_AR_CRITICO ||
        clima.temp > SIRI_CONSTANTS.CLIMA_TEMP_CRITICA ||
        clima.vento > SIRI_CONSTANTS.CLIMA_VENTO_CRITICO ||
        dadosSolo.umidade < SIRI_CONSTANTS.SOLO_UMIDADE_CRITICA
      ) {
        notaClima = SIRI_CONSTANTS.PONTUACAO_CLIMA_ALTO_RISCO;
      }

      let pontuacaoTotal = notaVegetacao + notaHistorico + notaIncendios + notaClima;

      // Penalidade para áreas severamente degradadas ou urbanizadas
      if (ndviAtual < SIRI_CONSTANTS.LIMIAR_NDVI_DEGRADADO) {
        pontuacaoTotal = Math.min(pontuacaoTotal, SIRI_CONSTANTS.TETO_PONTUACAO_DEGRADADO);
      }

      let classificacao = 'Área com Baixo Risco Ambiental (Potencialmente Classificável)';
      if (pontuacaoTotal < SIRI_CONSTANTS.CLASSIFICACAO_ATENCAO_MIN) {
        classificacao = 'Área Sob Risco Ambiental';
      } else if (pontuacaoTotal < SIRI_CONSTANTS.CLASSIFICACAO_BAIXO_RISCO_MIN) {
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
      this.logger.error(`Erro no cálculo do índice SIRI: ${(error as Error).message}`);
      throw new Error(`Falha no cálculo do laudo SIRI: ${(error as Error).message}`);
    }
  }
}
