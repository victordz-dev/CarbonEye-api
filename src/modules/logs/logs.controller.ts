import { Controller, Post, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { LogsService } from './logs.service';
import { NivelLog, OrigemLog } from '../../entities/sistemalog.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GetUser } from '../../decorators/get-user.decorator';

@ApiTags('Logs')
@Controller('logs')
export class LogsController {
  constructor(private readonly logsService: LogsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  async receberLogFront(
    @GetUser('id') usuarioId: string,
    @Body()
    body: {
      acao: string;
      detalhes?: Record<string, unknown>;
      nivel?: NivelLog;
    },
  ): Promise<{ success: boolean }> {
    await this.logsService.registrarLog({
      acao: body.acao || 'Ação Frontend Não Especificada',
      detalhes: body.detalhes,
      nivel: body.nivel || NivelLog.ERROR,
      origem: OrigemLog.FRONTEND,
      usuarioId,
    });

    return { success: true };
  }
}
