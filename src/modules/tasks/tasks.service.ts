import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Area } from '../../entities/area.entity';
import { FocoIncendio } from '../../entities/focoincendio.entity';
import { Alerta } from '../../entities/alerta.entity';
import { HistoricoSiri } from '../../entities/historicosiri.entity';
import type { Coordenada } from '../geo/geo.types';
import { obterCentroide } from '../geo/geo.utils';
import { IntegrationsService } from '../integrations/integrations.service';
import { SiriService } from '../siri/siri.service';
import { obterStatusPorPontuacao } from '../siri/siri.utils';
import { NotificationsService } from '../notifications/notifications.service';
import { Point } from 'geojson';

const CRON_CONCURRENCY = 3;

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  constructor(
    @InjectRepository(Area)
    private readonly areaRepository: Repository<Area>,
    @InjectRepository(FocoIncendio)
    private readonly focoRepository: Repository<FocoIncendio>,
    @InjectRepository(Alerta)
    private readonly alertaRepository: Repository<Alerta>,
    @InjectRepository(HistoricoSiri)
    private readonly historicoRepository: Repository<HistoricoSiri>,
    private readonly siriService: SiriService,
    private readonly integrationsService: IntegrationsService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * Extrai coordenadas de uma área a partir do GeoJSON armazenado.
   */
  private extrairCoordenadas(area: Area): Coordenada[] {
    return area.geometria.coordinates[0].map(
      (pt: number[]) => ({
        longitude: pt[0],
        latitude: pt[1],
      }),
    );
  }

  /**
   * Processa uma área individual para o cron de atualização SIRI semanal.
   */
  private async processarAreaSiri(area: Area): Promise<void> {
    const coords = this.extrairCoordenadas(area);

    // Calcula o SIRI com os dados atualizados
    const siri = await this.siriService.calcularSiri(
      coords,
      area.agroPolygonId || '',
    );

    // Atualiza a entidade de Area com a nova nota
    area.siriAtual = siri.pontuacaoTotal;
    area.classificacaoAtual = siri.classificacao;
    area.status = obterStatusPorPontuacao(siri.pontuacaoTotal);
    area.ultimaAnalise = new Date();
    await this.areaRepository.save(area);

    // Grava SEMPRE o novo histórico SIRI no banco para a série temporal
    const historico = this.historicoRepository.create({
      areaId: area.id,
      notaVegetacao: siri.detalhes.vegetacao,
      notaHistoricoNdvi: siri.detalhes.historico,
      notaIncendios: siri.detalhes.incendios,
      notaClima: siri.detalhes.clima,
      pontuacaoTotal: siri.pontuacaoTotal,
      classificacaoGeral: siri.classificacao,
    });
    await this.historicoRepository.save(historico);
  }

  /**
   * Processa uma área individual para o cron de monitoramento de clima e fogo.
   */
  private async processarAreaClimaFogo(area: Area): Promise<void> {
    const coords = this.extrairCoordenadas(area);

    // 1. Busca anomalias térmicas (queimadas ativas recentes no raio de 10km)
    const focosAtivos = await this.integrationsService.obterFocosAtivosRecentes(coords);

    if (focosAtivos.length > 0) {
      this.logger.log(`Detectados ${focosAtivos.length} focos ativos perto da área "${area.nome}".`);

      for (const foco of focosAtivos) {
        const ponto: Point = {
          type: 'Point',
          coordinates: [foco.longitude, foco.latitude],
        };

        // Deduplicação composta: coordenada + janela temporal
        const jaExiste = await this.focoRepository
          .createQueryBuilder('f')
          .where(
            'ST_DWithin(f.geometria, ST_SetSRID(ST_MakePoint(:lon, :lat), 4326), 0.001)',
          )
          .andWhere('f.data BETWEEN :inicio AND :fim')
          .setParameters({
            lon: foco.longitude,
            lat: foco.latitude,
            inicio: new Date(foco.data.getTime() - 30 * 60000),
            fim: new Date(foco.data.getTime() + 30 * 60000),
          })
          .getOne();

        if (!jaExiste) {
          const novoFoco = this.focoRepository.create({
            geometria: ponto,
            data: foco.data,
            satelite: 'VIIRS',
            confianca: 80,
          });
          await this.focoRepository.save(novoFoco);
        }
      }

      const mensagem = `Atenção: Novo foco de calor ativo detectado nas proximidades do seu projeto "${area.nome}". O status atual é ${area.classificacaoAtual}.`;
      const novoAlerta = this.alertaRepository.create({
        areaId: area.id,
        tipo: 'INCENDIO',
        mensagem,
        lida: false,
      });
      await this.alertaRepository.save(novoAlerta);

      if (area.usuario?.expoPushToken) {
        await this.notificationsService.sendPushNotification(
          area.usuario.expoPushToken,
          '🔥 Risco de Incêndio',
          mensagem,
          { areaId: area.id, tipo: 'INCENDIO' },
        );
      }
    }

    // 2. Checa por clima extremo
    const centroide = obterCentroide(coords);
    const climaAtual = await this.integrationsService.obterClimaAtual(
      centroide.latitude,
      centroide.longitude,
    );

    if (climaAtual) {
      const temp = climaAtual.temp;
      const hum = climaAtual.umidade;

      if (temp > 35 || hum < 20) {
        const msgClima = `Alerta Climático: Condições extremas registradas na área "${area.nome}". Temperatura: ${temp}°C, Umidade: ${hum}%.`;
        const alertaClima = this.alertaRepository.create({
          areaId: area.id,
          tipo: 'CLIMA',
          mensagem: msgClima,
          lida: false,
        });
        await this.alertaRepository.save(alertaClima);

        if (area.usuario?.expoPushToken) {
          await this.notificationsService.sendPushNotification(
            area.usuario.expoPushToken,
            '⚠️ Clima Extremo',
            msgClima,
            { areaId: area.id, tipo: 'CLIMA' },
          );
        }
      }
    } else {
      this.logger.warn(
        `Dados climáticos indisponíveis para área "${area.nome}". Verificação de clima extremo ignorada.`,
      );
    }
  }

  /**
   * Processa um array de áreas em paralelo com concorrência controlada.
   */
  private async processarComConcorrencia<T>(
    areas: Area[],
    processador: (area: Area) => Promise<T>,
    contexto: string,
  ): Promise<void> {
    for (let i = 0; i < areas.length; i += CRON_CONCURRENCY) {
      const chunk = areas.slice(i, i + CRON_CONCURRENCY);
      const resultados = await Promise.allSettled(
        chunk.map((area) => processador(area)),
      );

      for (let j = 0; j < resultados.length; j++) {
        const resultado = resultados[j];
        if (resultado.status === 'rejected') {
          this.logger.error(
            `Erro ao processar ${contexto} da área ${chunk[j].nome}: ${resultado.reason}`,
          );
        }
      }
    }
  }

  /**
   * Recálculo do Índice SIRI: Executa semanalmente (domingo à meia-noite).
   * Processamento pesado (Imagens de Satélite).
   */
  @Cron('0 0 * * 0')
  async executarAtualizacaoSiriSemanal(): Promise<void> {
    this.logger.log('Iniciando Cron Job de atualização SIRI semanal...');

    const areasMonitoradas = await this.areaRepository.find({
      where: { monitoramentoAtivo: true },
      relations: ['usuario'],
    });

    if (areasMonitoradas.length === 0) {
      this.logger.log('Nenhuma área ativa cadastrada para monitoramento SIRI.');
      return;
    }

    await this.processarComConcorrencia(
      areasMonitoradas,
      (area) => this.processarAreaSiri(area),
      'varredura SIRI',
    );
  }

  /**
   * Monitoramento contínuo: Executa de hora em hora para checar focos de incêndio
   * ativos e condições climáticas extremas.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async monitorarClimaEFogo(): Promise<void> {
    this.logger.log('Iniciando Cron Job de monitoramento de Clima e Fogo...');

    const areasMonitoradas = await this.areaRepository.find({
      where: { monitoramentoAtivo: true },
      relations: ['usuario'],
    });

    if (areasMonitoradas.length === 0) {
      return;
    }

    await this.processarComConcorrencia(
      areasMonitoradas,
      (area) => this.processarAreaClimaFogo(area),
      'clima/fogo',
    );
  }

  /**
   * Coletor de lixo: Executa de hora em hora para encontrar e excluir polígonos
   * criados na API do AgroMonitoring que ficaram órfãos (não foram salvos no DB)
   */
  @Cron(CronExpression.EVERY_HOUR)
  async sincronizarPoligonos(): Promise<void> {
    this.logger.log(
      'Iniciando Garbage Collector de polígonos (AgroMonitoring)...',
    );

    try {
      const dbAreas = await this.areaRepository.find({
        select: ['agroPolygonId'],
      });
      const dbPolygonIds = new Set(
        dbAreas.map((a) => a.agroPolygonId).filter((id) => id),
      );

      const apiPolygons = await this.integrationsService.obterTodosPoligonos();

      const agoraUnix = Math.floor(Date.now() / 1000);
      const umaHoraAtras = agoraUnix - 3600;

      let excluidos = 0;

      for (const apiPoly of apiPolygons) {
        // Se o polígono não existe no nosso banco de dados
        if (!dbPolygonIds.has(apiPoly.id)) {
          // Só exclui se foi criado há mais de 1 hora
          if (apiPoly.created_at < umaHoraAtras) {
            this.logger.log(
              `Deletando polígono órfão: ${apiPoly.id} (Criado em ${apiPoly.created_at})`,
            );
            await this.integrationsService.deletarPoligono(apiPoly.id);
            excluidos++;
          }
        }
      }

      this.logger.log(
        `Garbage Collector finalizado. ${excluidos} polígonos órfãos excluídos.`,
      );
    } catch (error) {
      this.logger.error(
        `Erro ao executar sincronização de polígonos: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Gera relatório mensal para todas as áreas ativas.
   */
  @Cron(CronExpression.EVERY_1ST_DAY_OF_MONTH_AT_MIDNIGHT)
  async gerarRelatoriosMensais(): Promise<void> {
    this.logger.log('Iniciando geração de relatórios mensais...');
    const areasMonitoradas = await this.areaRepository.find({
      where: { monitoramentoAtivo: true },
      relations: ['usuario'],
    });

    for (const area of areasMonitoradas) {
      try {
        const mesAnterior = new Date();
        mesAnterior.setMonth(mesAnterior.getMonth() - 1);
        const mesStr = mesAnterior.toLocaleString('pt-BR', {
          month: 'long',
          year: 'numeric',
        });

        const mensagem = `Seu Relatório Mensal SIRI de ${mesStr} para a área "${area.nome}" está disponível para download.`;

        const novoAlerta = this.alertaRepository.create({
          areaId: area.id,
          tipo: 'RELATORIO',
          mensagem,
          lida: false,
        });
        await this.alertaRepository.save(novoAlerta);

        if (area.usuario?.expoPushToken) {
          await this.notificationsService.sendPushNotification(
            area.usuario.expoPushToken,
            '📄 Relatório Disponível',
            mensagem,
            { areaId: area.id, tipo: 'RELATORIO' },
          );
        }
      } catch (error) {
        this.logger.error(
          `Erro ao gerar alerta de relatório para a área ${area.nome}: ${(error as Error).message}`,
        );
      }
    }
  }
}
