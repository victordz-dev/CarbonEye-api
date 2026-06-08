export interface AnalisarAreaResponse {
  status_territorial: string;
  classificacao_final: string;
  agro_polygon_id?: string;
  siri?: {
    pontuacao_total: number;
    detalhes: {
      vegetacao: number;
      historico: number;
      incendios: number;
      clima: number;
    };
  };
  area_m2?: number;
  clima_atual?: {
    temp: number;
    umidade: number;
  };
  imagem_satelite_url?: string;
  motivo?: string;
}

export interface HistoricoAreaResponse {
  linha_do_tempo_ndvi: Array<{ data: string; valor: number }>;
  ocorrencias_incendio: number;
  evi_atual?: number;
  ndwi_atual?: number;
  umidade_solo?: number;
  temp_solo?: number;
  imagem_satelite_truecolor?: string;
  imagem_satelite_ndvi?: string;
}
