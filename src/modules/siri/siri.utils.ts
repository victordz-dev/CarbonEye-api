import { SIRI_CONSTANTS } from './siri.constants';

export enum StatusArea {
  NORMAL = 'NORMAL',
  ALERTA = 'ALERTA',
  EMERGENCIA = 'EMERGENCIA',
}

export enum TipoAlerta {
  INCENDIO = 'INCENDIO',
  DEGRADACAO = 'DEGRADACAO',
  CLIMA = 'CLIMA',
  RELATORIO = 'RELATORIO',
  FOGO = 'FOGO',
}

/**
 * Determina o status de uma área com base na pontuação SIRI.
 * Centraliza a lógica que antes era duplicada em areas.service.ts e tasks.service.ts.
 */
export function obterStatusPorPontuacao(pontuacao: number): StatusArea {
  if (pontuacao < SIRI_CONSTANTS.CLASSIFICACAO_ATENCAO_MIN)
    return StatusArea.EMERGENCIA;
  if (pontuacao < SIRI_CONSTANTS.CLASSIFICACAO_BAIXO_RISCO_MIN)
    return StatusArea.ALERTA;
  return StatusArea.NORMAL;
}
