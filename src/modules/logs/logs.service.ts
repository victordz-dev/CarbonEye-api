import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  SistemaLog,
  NivelLog,
  OrigemLog,
} from '../../entities/sistemalog.entity';

@Injectable()
export class LogsService {
  private readonly logger = new Logger(LogsService.name);

  constructor(
    @InjectRepository(SistemaLog)
    private readonly logsRepository: Repository<SistemaLog>,
  ) {}

  async registrarLog(dados: {
    nivel?: NivelLog;
    origem?: OrigemLog;
    usuarioId?: string;
    acao: string;
    detalhes?: Record<string, unknown>;
  }): Promise<void> {
    try {
      const detalhesSeguros = this.higienizarDetalhes(dados.detalhes);

      const log = this.logsRepository.create({
        nivel: dados.nivel || NivelLog.INFO,
        origem: dados.origem || OrigemLog.BACKEND,
        usuarioId: dados.usuarioId,
        acao: dados.acao,
        detalhes: detalhesSeguros,
      });

      await this.logsRepository.save(log);
    } catch (error) {
      // Ignoramos o throw para não interromper a aplicação
      this.logger.error(
        `Falha ao registrar log no banco de dados: ${(error as Error).message}`,
      );
    }
  }

  private higienizarDetalhes(
    detalhes?: Record<string, unknown>,
  ): Record<string, unknown> | undefined {
    if (!detalhes) return undefined;

    try {
      const copia = JSON.parse(JSON.stringify(detalhes));
      const camposSensiveis = ['senha', 'password', 'token', 'authorization'];

      const recursivo = (obj: unknown) => {
        if (!obj || typeof obj !== 'object') return;
        const record = obj as Record<string, unknown>;
        for (const key in record) {
          if (typeof record[key] === 'object' && record[key] !== null) {
            recursivo(record[key]);
          } else if (camposSensiveis.includes(key.toLowerCase())) {
            record[key] = '[OCULTO_POR_SEGURANCA]';
          }
        }
      };

      recursivo(copia);
      return copia;
    } catch {
      return { _raw: 'Unparseable Details' };
    }
  }
}
