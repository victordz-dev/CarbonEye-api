import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Area } from '../../entities/area.entity';
import { HistoricoSiri } from '../../entities/historicosiri.entity';
import { Alerta } from '../../entities/alerta.entity';
import {
  GeoService,
  Coordenada,
  coordenadasParaWktPolygon,
} from '../geo/geo.service';
import { SiriService } from '../siri/siri.service';
import {
  IntegrationsService,
  isDentroDoBrasil,
  isExatamenteNoBrasil,
} from '../integrations/integrations.service';
import { LogsService } from '../logs/logs.service';
import { SnapshotService } from './snapshot.service';
import { NivelLog, OrigemLog } from '../../entities/sistemalog.entity';
import { SalvarAreaDto } from './dto/salvar-area.dto';
import { AlternarMonitoramentoDto } from './dto/alternar-monitoramento.dto';
import { Polygon } from 'geojson';
import {
  TAMANHO_MINIMO_HA,
  COTA_MAXIMA_USUARIO_HA,
  CONVERSAO_M2_HA,
  RAIO_FOCOS_HORAS,
} from './areas.constants';

import {
  AnalisarAreaResponse,
  HistoricoAreaResponse,
} from './areas.interfaces';

@Injectable()
export class AreasService {
  private readonly logger = new Logger(AreasService.name);

  constructor(
    @InjectRepository(Area)
    private readonly areaRepository: Repository<Area>,
    @InjectRepository(HistoricoSiri)
    private readonly historicoRepository: Repository<HistoricoSiri>,
    @InjectRepository(Alerta)
    private readonly alertaRepository: Repository<Alerta>,
    private readonly geoService: GeoService,
    private readonly siriService: SiriService,
    private readonly integrationsService: IntegrationsService,
    private readonly logsService: LogsService,
    private readonly snapshotService: SnapshotService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Realiza a análise preliminar (triagem) da área desenhada.
   * Não salva no banco de dados e calcula limites e PostGIS.
   */
  async analisarArea(
    usuarioId: string,
    coords: Coordenada[],
  ): Promise<AnalisarAreaResponse> {
    let polyId: string | undefined;
    try {
      await this.logsService.registrarLog({
        acao: 'Solicitação de Análise de Área (Triagem)',
        usuarioId,
        nivel: NivelLog.INFO,
        origem: OrigemLog.BACKEND,
        detalhes: { quantidadePontos: coords.length },
      });

      const dentroBrasil = await isExatamenteNoBrasil(coords);
      if (!dentroBrasil) {
        throw new BadRequestException(
          'O polígono desenhado possui coordenadas fora do território brasileiro. Esta aplicação restringe o monitoramento estritamente ao Brasil.',
        );
      }

      const wkt = coordenadasParaWktPolygon(coords);

      // 1. Calcula o tamanho do polígono no PostGIS
      const areaResult = (await this.areaRepository.query(
        'SELECT ST_Area(ST_GeomFromText($1, 4326)::geography) as area_m2',
        [wkt],
      )) as unknown as { area_m2: string }[];
      const areaM2 = parseFloat(areaResult[0].area_m2);
      const areaHa = areaM2 / CONVERSAO_M2_HA;

      // Valida teto mínimo por consulta
      if (areaHa < TAMANHO_MINIMO_HA) {
        throw new BadRequestException(
          `A área desenhada possui apenas ${areaHa.toFixed(2)} hectares. O tamanho mínimo suportado pelo satélite é de ${TAMANHO_MINIMO_HA.toFixed(2)} hectare.`,
        );
      }

      // Check total global user quota (only for active monitoring)
      const totalAreaResult = await this.areaRepository.query(
        'SELECT SUM(ST_Area(geometria::geography)) as total_m2 FROM areas WHERE usuario_id = $1 AND monitoramento_ativo = true',
        [usuarioId],
      );
      const totalUserM2 = parseFloat(totalAreaResult[0]?.total_m2 || '0');
      const totalUserHa = totalUserM2 / CONVERSAO_M2_HA;

      if (totalUserHa + areaHa > COTA_MAXIMA_USUARIO_HA) {
        throw new BadRequestException(
          `Cota global excedida. Você já possui ${totalUserHa.toFixed(2)} ha salvos. O limite da conta é de ${COTA_MAXIMA_USUARIO_HA} ha.`,
        );
      }

      // 3. Validação territorial PostGIS (TI / UC)
      const sobreposicao = await this.geoService.verificarSobreposicao(coords);
      if (sobreposicao.intercepta) {
        return {
          status_territorial: 'BLOQUEADO',
          classificacao_final: 'Área com Restrição Territorial Identificada',
          motivo: `Sobreposição detectada com a reserva protegida: ${sobreposicao.nomeReserva} (${sobreposicao.tipo}).`,
        };
      }

      // 4. Integração com APIs externas para cálculo do SIRI (Área Livre)
      const mockName = `Triagem_Temp_${Date.now()}`;
      polyId = await this.integrationsService.criarPoligono(coords, mockName);

      const siri = await this.siriService.calcularSiri(coords, polyId);

      return {
        status_territorial: 'LIVRE',
        classificacao_final: siri.classificacao,
        agro_polygon_id: polyId,
        siri: {
          pontuacao_total: siri.pontuacaoTotal,
          detalhes: siri.detalhes,
        },
        area_m2: parseFloat(areaM2.toFixed(1)),
        clima_atual: {
          temp: siri.climaAtual.temp,
          umidade: siri.climaAtual.umidade,
        },
      };
    } catch (error) {
      // Rollback imediato: Se o polígono foi criado na API mas a análise falhou (ex: timeout), deleta ele imediatamente.
      if (polyId) {
        this.logger.log(
          `Rollback: Deletando polígono ${polyId} devido à falha na análise.`,
        );
        await this.integrationsService
          .deletarPoligono(polyId)
          .catch((e) =>
            this.logger.error(
              `Falha no rollback do polígono ${polyId}: ${e.message}`,
            ),
          );
      }

      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error(`Erro ao analisar área: ${(error as Error).message}`);
      throw new BadRequestException(
        `Falha ao processar análise da área: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Salva a área no banco de dados e inicia monitoramento
   */
  async salvarArea(
    usuarioId: string,
    dto: SalvarAreaDto,
  ): Promise<{ id: string; mensagem: string }> {
    let polyId = dto.agro_polygon_id;
    let siri = dto.siri_completo;
    let areaSalva: Area | undefined;

    try {
      const dentroBrasil = await isExatamenteNoBrasil(dto.poligono);
      if (!dentroBrasil) {
        throw new BadRequestException(
          'O polígono desenhado possui coordenadas fora do território brasileiro. Esta aplicação restringe o monitoramento estritamente ao Brasil.',
        );
      }

      const wkt = coordenadasParaWktPolygon(dto.poligono);

      const areaResult = (await this.areaRepository.query(
        'SELECT ST_Area(ST_GeomFromText($1, 4326)::geography) as area_m2',
        [wkt],
      )) as unknown as { area_m2: string }[];
      const areaM2 = parseFloat(areaResult[0].area_m2);
      const areaHa = areaM2 / CONVERSAO_M2_HA;

      if (areaHa < TAMANHO_MINIMO_HA) {
        throw new BadRequestException(
          `A área é menor que o limite mínimo de ${TAMANHO_MINIMO_HA} hectare suportado pelo satélite.`,
        );
      }

      const totalAreaResult = await this.areaRepository.query(
        'SELECT SUM(ST_Area(geometria::geography)) as total_m2 FROM areas WHERE usuario_id = $1 AND monitoramento_ativo = true',
        [usuarioId],
      );
      const totalUserM2 = parseFloat(totalAreaResult[0]?.total_m2 || '0');
      const totalUserHa = totalUserM2 / CONVERSAO_M2_HA;

      if (totalUserHa + areaHa > COTA_MAXIMA_USUARIO_HA) {
        throw new BadRequestException(
          `Cota global excedida. Você já possui ${totalUserHa.toFixed(2)} ha salvos. O limite da conta é de ${COTA_MAXIMA_USUARIO_HA} ha.`,
        );
      }

      const sobreposicao = await this.geoService.verificarSobreposicao(
        dto.poligono,
      );
      if (sobreposicao.intercepta) {
        throw new BadRequestException(
          'Não é permitido salvar áreas que sobreponham territórios protegidos.',
        );
      }

      if (!polyId) {
        polyId = await this.integrationsService.criarPoligono(
          dto.poligono,
          dto.nome,
        );
      }

      if (!siri) {
        siri = await this.siriService.calcularSiri(dto.poligono, polyId);
      }

      const formattedCoords = dto.poligono.map((c) => [
        c.longitude,
        c.latitude,
      ]);
      const primeiroPonto = formattedCoords[0];
      const ultimoPonto = formattedCoords[formattedCoords.length - 1];

      if (
        primeiroPonto[0] !== ultimoPonto[0] ||
        primeiroPonto[1] !== ultimoPonto[1]
      ) {
        formattedCoords.push(primeiroPonto);
      }
      const geometria: Polygon = {
        type: 'Polygon',
        coordinates: [formattedCoords],
      };

      const novaArea = this.areaRepository.create({
        usuarioId,
        nome: dto.nome,
        geometria,
        status:
          siri.pontuacaoTotal < 40
            ? 'EMERGENCIA'
            : siri.pontuacaoTotal < 70
              ? 'ALERTA'
              : 'NORMAL',
        siriAtual: siri.pontuacaoTotal,
        classificacaoAtual: siri.classificacao,
        monitoramentoAtivo: dto.monitoramento_ativo,
        agroPolygonId: polyId,
        ultimaAnalise: new Date(),
      });

      const historico = this.historicoRepository.create({
        notaVegetacao: siri.detalhes.vegetacao,
        notaHistoricoNdvi: siri.detalhes.historico,
        notaIncendios: siri.detalhes.incendios,
        notaClima: siri.detalhes.clima,
        pontuacaoTotal: siri.pontuacaoTotal,
        classificacaoGeral: siri.classificacao,
      });

      // Transação Controlada
      await this.dataSource.transaction(async (manager) => {
        areaSalva = await manager.save(Area, novaArea);
        historico.areaId = areaSalva.id;
        await manager.save(HistoricoSiri, historico);
      });

      if (areaSalva && !dto.monitoramento_ativo && polyId) {
        try {
          const snapshot = await this.snapshotService.gerarSnapshot(polyId, dto.poligono);
          areaSalva.snapshotDetalhes = snapshot;
          await this.areaRepository.save(areaSalva);
          await this.integrationsService.deletarPoligono(polyId);
          polyId = undefined; // Nullify since we deleted it
        } catch (e) {
          console.warn('Falha ao deletar polígono descartável na API:', e);
        }
      }

      const ativosCount = await this.areaRepository.count({
        where: { usuarioId, monitoramentoAtivo: true },
      });

      return {
        id: areaSalva!.id,
        mensagem: `Área salva com sucesso. ${ativosCount} de 2 mapas em monitoramento.`,
      };
    } catch (error) {
      if (polyId && !dto.agro_polygon_id) {
        this.logger.log(
          `Rollback externo: Deletando polígono ${polyId} devido à falha ao salvar no banco.`,
        );
        await this.integrationsService
          .deletarPoligono(polyId)
          .catch((e) =>
            this.logger.error(
              `Falha no rollback do polígono ${polyId}: ${e.message}`,
            ),
          );
      }

      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error(`Erro ao salvar área: ${(error as Error).message}`);
      throw new BadRequestException(
        `Falha ao salvar a área no sistema: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Lista as áreas salvas do usuário (para dashboard e históricos)
   */
  async listarAreas(usuarioId: string): Promise<Area[]> {
    return this.areaRepository.find({
      where: { usuarioId },
      relations: ['alertas'],
      order: { criadoEm: 'DESC' },
    });
  }

  /**
   * Retorna os dados históricos do NDVI e focos de calor locais para gráficos
   */
  async obterHistoricoArea(
    usuarioId: string,
    areaId: string,
  ): Promise<HistoricoAreaResponse> {
    const area = await this.areaRepository.findOne({
      where: { id: areaId, usuarioId },
    });
    if (!area) {
      throw new NotFoundException('Área não encontrada.');
    }

    const geoResult = await this.areaRepository.query(
      'SELECT ST_AsGeoJSON(geometria) as geojson FROM areas WHERE id = $1',
      [area.id],
    );
    const geojson = JSON.parse(geoResult[0].geojson);
    const coords: Coordenada[] = geojson.coordinates[0].map((pt: number[]) => ({
      longitude: pt[0],
      latitude: pt[1],
    }));

    if (area.monitoramentoAtivo === false && area.snapshotDetalhes) {
      return area.snapshotDetalhes;
    }

    return this.snapshotService.gerarSnapshot(area.agroPolygonId || '', coords);
  }



  /**
   * Ativa ou pausa o monitoramento contínuo de uma área
   */
  async alternarMonitoramento(
    usuarioId: string,
    areaId: string,
    dto: AlternarMonitoramentoDto,
  ): Promise<{ mensagem: string }> {
    const area = await this.areaRepository.findOne({
      where: { id: areaId, usuarioId },
    });
    if (!area) {
      throw new NotFoundException('Área não encontrada.');
    }

    if (dto.monitoramento_ativo) {
      // Valida limite de 2 ativos
      const countAtivos = await this.areaRepository.count({
        where: { usuarioId, monitoramentoAtivo: true },
      });
      if (countAtivos >= 2 && !area.monitoramentoAtivo) {
        throw new BadRequestException(
          'Você já possui 2 mapas em monitoramento contínuo ativo. Pause um deles para prosseguir.',
        );
      }
    }

    if (!dto.monitoramento_ativo && area.monitoramentoAtivo) {
      // Obter coordenadas para gerar o snapshot
      const geoResult = await this.areaRepository.query(
        'SELECT ST_AsGeoJSON(geometria) as geojson FROM areas WHERE id = $1',
        [area.id],
      );
      const geojson = JSON.parse(geoResult[0].geojson);
      const coords: Coordenada[] = geojson.coordinates[0].map(
        (pt: number[]) => ({
          longitude: pt[0],
          latitude: pt[1],
        }),
      );

      // Gera o snapshot
      try {
        const snapshot = await this.snapshotService.gerarSnapshot(
          area.agroPolygonId || '',
          coords,
        );
        area.snapshotDetalhes = snapshot;
      } catch (e) {
        console.warn(
          'Não foi possível gerar o snapshot ao desativar monitoramento',
          e,
        );
      }

      // Exclui da API para economizar limites
      if (area.agroPolygonId) {
        try {
          await this.integrationsService.deletarPoligono(area.agroPolygonId);
        } catch (e) {
          console.warn(
            'Falha ao deletar polígono da API no alternarMonitoramento:',
            e,
          );
        }
      }
    }

    area.monitoramentoAtivo = dto.monitoramento_ativo;
    await this.areaRepository.save(area);

    return {
      mensagem: dto.monitoramento_ativo
        ? 'Monitoramento ativado com sucesso.'
        : 'Monitoramento pausado e snapshot gerado com sucesso.',
    };
  }

  /**
   * Exclui uma área do histórico
   */
  async excluirArea(
    usuarioId: string,
    areaId: string,
  ): Promise<{ mensagem: string }> {
    const area = await this.areaRepository.findOne({
      where: { id: areaId, usuarioId },
    });

    if (!area) {
      throw new NotFoundException('Área não encontrada.');
    }

    if (area.agroPolygonId) {
      try {
        await this.integrationsService.deletarPoligono(area.agroPolygonId);
      } catch (e: any) {
        // Ignora erro caso o polígono já tenha sido excluído pela desativação
        console.warn(`Aviso ao excluir polígono ${area.agroPolygonId} da API:`, e?.message || e);
      }
    }

    await this.areaRepository.remove(area);
    return { mensagem: 'Área excluída com sucesso.' };
  }

  /**
   * (Debug) Cria um alerta falso na área escolhida para fins de apresentação/teste.
   */
  async criarAlertaMock(
    usuarioId: string,
    areaId: string,
  ): Promise<{ mensagem: string }> {
    const area = await this.areaRepository.findOne({
      where: { id: areaId, usuarioId },
    });
    if (!area) {
      throw new NotFoundException('Área não encontrada.');
    }

    const mockAlertas = [
      {
        tipo: 'FOGO',
        msg: 'ALERTA CRÍTICO DA NASA (FIRMS): Detecção de múltiplos focos de calor nas últimas 2 horas no entorno do seu polígono. Risco de incêndio iminente.',
      },
      {
        tipo: 'DEGRADACAO',
        msg: 'ALERTA DO SATÉLITE: Queda brusca no NDVI detectada na passagem de hoje. Indícios de desmatamento ou supressão vegetal acelerada.',
      },
      {
        tipo: 'CLIMA',
        msg: 'ALERTA CLIMÁTICO (OpenWeather): Condições extremas de baixa umidade e alta temperatura identificadas na área, elevando o risco de perdas agrícolas e incêndios secundários.',
      },
    ];

    const alertaFalso =
      mockAlertas[Math.floor(Math.random() * mockAlertas.length)];

    const alerta = this.alertaRepository.create({
      areaId: area.id,
      tipo: alertaFalso.tipo,
      mensagem: alertaFalso.msg,
      lida: false,
    });
    await this.alertaRepository.save(alerta);

    return { mensagem: 'Alerta de teste (mock) criado com sucesso.' };
  }

  /**
   * Renomeia uma área
   */
  async renomearArea(
    usuarioId: string,
    areaId: string,
    novoNome: string,
  ): Promise<{ mensagem: string }> {
    const area = await this.areaRepository.findOne({
      where: { id: areaId, usuarioId },
    });

    if (!area) {
      throw new NotFoundException('Área não encontrada.');
    }

    if (!novoNome || novoNome.trim() === '') {
      throw new BadRequestException('O nome não pode estar vazio.');
    }

    area.nome = novoNome.trim();
    await this.areaRepository.save(area);

    return { mensagem: 'Área renomeada com sucesso.' };
  }
}
