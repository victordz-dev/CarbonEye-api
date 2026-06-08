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
    detalhes?: Record<string, any>;
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
    detalhes?: Record<string, any>,
  ): Record<string, any> | null {
    if (!detalhes) return null;

    try {
      const copia = JSON.parse(JSON.stringify(detalhes));
      const camposSensiveis = ['senha', 'password', 'token', 'authorization'];

      const recursivo = (obj: any) => {
        if (!obj || typeof obj !== 'object') return;
        for (const key in obj) {
          if (typeof obj[key] === 'object' && obj[key] !== null) {
            recursivo(obj[key]);
          } else if (camposSensiveis.includes(key.toLowerCase())) {
            obj[key] = '[OCULTO_POR_SEGURANCA]';
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
