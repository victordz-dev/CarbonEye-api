import { Injectable } from '@nestjs/common';
import { GeoService } from '../geo/geo.service';
import type { Coordenada } from '../geo/geo.types';
import { IntegrationsService } from '../integrations/integrations.service';
import { HistoricoAreaResponse } from './areas.interfaces';
import { RAIO_FOCOS_MESES } from './areas.constants';

@Injectable()
export class SnapshotService {
  constructor(
    private readonly integrationsService: IntegrationsService,
    private readonly geoService: GeoService,
  ) {}

  async gerarSnapshot(
    agroPolygonId: string,
    coords: Coordenada[],
  ): Promise<HistoricoAreaResponse> {
    if (!agroPolygonId) {
      return {
        linha_do_tempo_ndvi: [],
        ocorrencias_incendio: 0,
        imagem_satelite_truecolor: 'https://picsum.photos/id/10/400/300',
        imagem_satelite_ndvi: 'https://picsum.photos/id/10/400/300',
      };
    }

    const [rawNdviValores, indicesExtraRaw, dadosSoloRaw, quantidadeFocos] =
      await Promise.all([
        this.integrationsService.obterHistoricoNdvi(agroPolygonId),
        this.integrationsService.obterIndicesRecentes(agroPolygonId),
        this.integrationsService.obterDadosSolo(agroPolygonId),
        this.geoService.obterQuantidadeFocosNoEntorno(coords, RAIO_FOCOS_MESES),
      ]);

    const ndviMensalMap = new Map<string, { soma: number; qtd: number }>();

    rawNdviValores.forEach((item) => {
      if (item.valor >= 0.1) {
        const d = new Date(item.dataUnix * 1000);
        const mesAno = d.toISOString().substring(0, 7) + '-01';

        const atual = ndviMensalMap.get(mesAno) || { soma: 0, qtd: 0 };
        ndviMensalMap.set(mesAno, {
          soma: atual.soma + item.valor,
          qtd: atual.qtd + 1,
        });
      }
    });

    const ndviTimeline = Array.from(ndviMensalMap.entries())
      .map(([data, stats]) => ({
        data,
        valor: parseFloat((stats.soma / stats.qtd).toFixed(2)),
      }))
      .sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime());

    return {
      linha_do_tempo_ndvi: ndviTimeline,
      ocorrencias_incendio: quantidadeFocos,
      evi_atual: indicesExtraRaw?.evi,
      ndwi_atual: indicesExtraRaw?.ndwi,
      umidade_solo: dadosSoloRaw?.umidade,
      temp_solo: dadosSoloRaw?.tempSuperficie,
      imagem_satelite_truecolor: 'https://picsum.photos/id/10/400/300',
      imagem_satelite_ndvi: 'https://picsum.photos/id/10/400/300',
    };
  }
}
