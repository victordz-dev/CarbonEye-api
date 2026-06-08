import { Controller, Post, Body, Req } from '@nestjs/common';
import { LogsService } from './logs.service';
import { NivelLog, OrigemLog } from '../../entities/sistemalog.entity';
import type { Request } from 'express';

@Controller('logs')
export class LogsController {
  constructor(private readonly logsService: LogsService) {}

  @Post()
  async receberLogFront(
    @Body() body: { acao: string; detalhes?: any; nivel?: NivelLog; usuarioId?: string },
    @Req() request: Request,
  ) {
    await this.logsService.registrarLog({
      acao: body.acao || 'Ação Frontend Não Especificada',
      detalhes: {
        ...(body.detalhes || {}),
        userAgent: request.headers['user-agent'],
        ip: request.ip,
      },
      nivel: body.nivel || NivelLog.ERROR,
      origem: OrigemLog.FRONTEND,
      usuarioId: body.usuarioId,
    });

    return { success: true };
  }
}
