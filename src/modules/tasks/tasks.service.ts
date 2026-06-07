import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Area } from '../../entities/area.entity';
import { FocoIncendio } from '../../entities/focoincendio.entity';
import { Alerta } from '../../entities/alerta.entity';
import { HistoricoSiri } from '../../entities/historicosiri.entity';
import { Coordenada } from '../geo/geo.service';
import { IntegrationsService } from '../integrations/integrations.service';
import { SiriService } from '../siri/siri.service';
import { Point } from 'geojson';

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
  ) {}

  /**
   * Executa a varredura automática diária (à meia-noite) nas áreas sob monitoramento ativo.
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async executarMonitoramentoDiario(): Promise<void> {
    this.logger.log('Iniciando Cron Job de monitoramento diário...');

    const areasMonitoradas = await this.areaRepository.find({
      where: { monitoramentoAtivo: true },
    });

    if (areasMonitoradas.length === 0) {
      this.logger.log('Nenhuma área ativa cadastrada para monitoramento.');
      return;
    }

    for (const area of areasMonitoradas) {
      try {
        const coords: Coordenada[] = area.geometria.coordinates[0].map(
          (pt) => ({
            longitude: pt[0],
            latitude: pt[1],
          }),
        );

        // 1. Busca anomalias térmicas (queimadas ativas recentes no raio de 10km)
        const focosAtivos =
          await this.integrationsService.obterFocosAtivosRecentes(coords);

        if (focosAtivos.length > 0) {
          this.logger.log(
            `Detectados ${focosAtivos.length} focos ativos perto da área "${area.nome}".`,
          );

          // 2. Salva os focos novos na base de dados espacial local
          for (const foco of focosAtivos) {
            const ponto: Point = {
              type: 'Point',
              coordinates: [foco.longitude, foco.latitude],
            };

            const existe = await this.focoRepository.findOne({
              where: { data: foco.data },
            });

            if (!existe) {
              const novoFoco = this.focoRepository.create({
                geometria: ponto,
                data: foco.data,
                satelite: 'VIIRS',
                confianca: 80,
              });
              await this.focoRepository.save(novoFoco);
            }
          }

          // 3. Recalcula a pontuação do SIRI considerando os novos focos salvos no PostGIS
          const siri = await this.siriService.calcularSiri(
            coords,
            area.agroPolygonId || '',
          );

          // 4. Cria e persiste a notificação/alerta para o usuário
          const mensagem = `Atenção: Novo foco de calor ativo detectado nas proximidades do seu projeto "${area.nome}". O status foi rebaixado para ${siri.classificacao}.`;
          const novoAlerta = this.alertaRepository.create({
            areaId: area.id,
            tipo: 'INCENDIO',
            mensagem,
            lida: false,
          });
          await this.alertaRepository.save(novoAlerta);

          // 5. Atualiza a entidade de Area com a nova nota
          area.siriAtual = siri.pontuacaoTotal;
          area.classificacaoAtual = siri.classificacao;
          area.status =
            siri.pontuacaoTotal < 40
              ? 'EMERGENCIA'
              : siri.pontuacaoTotal < 70
                ? 'ALERTA'
                : 'NORMAL';
          area.ultimaAnalise = new Date();
          await this.areaRepository.save(area);

          // 6. Grava novo histórico SIRI no banco
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
        } else {
          // Apenas atualiza clima/ndvi periódico se não houver incêndios ativos novos
          const siri = await this.siriService.calcularSiri(
            coords,
            area.agroPolygonId || '',
          );

          area.siriAtual = siri.pontuacaoTotal;
          area.classificacaoAtual = siri.classificacao;
          area.status =
            siri.pontuacaoTotal < 40
              ? 'EMERGENCIA'
              : siri.pontuacaoTotal < 70
                ? 'ALERTA'
                : 'NORMAL';
          area.ultimaAnalise = new Date();
          await this.areaRepository.save(area);
        }
      } catch (error) {
        this.logger.error(
          `Erro ao processar varredura da área ${area.nome}: ${(error as Error).message}`,
        );
      }
    }
  }
}
