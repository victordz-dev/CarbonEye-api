import {
  Controller,
  Get,
  Patch,
  Delete,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AlertasService } from './alertas.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GetUser } from '../../decorators/get-user.decorator';
import { Alerta } from '../../entities/alerta.entity';

@ApiTags('Alertas')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('alertas')
export class AlertasController {
  constructor(private readonly alertasService: AlertasService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  async obterAlertas(@GetUser('id') usuarioId: string): Promise<Alerta[]> {
    return this.alertasService.obterAlertas(usuarioId);
  }

  @Patch(':id/lida')
  @HttpCode(HttpStatus.OK)
  async marcarComoLida(
    @GetUser('id') usuarioId: string,
    @Param('id', new ParseUUIDPipe()) alertaId: string,
  ): Promise<{ mensagem: string }> {
    return this.alertasService.marcarComoLida(usuarioId, alertaId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async excluirAlerta(
    @GetUser('id') usuarioId: string,
    @Param('id', new ParseUUIDPipe()) alertaId: string,
  ): Promise<{ mensagem: string }> {
    return this.alertasService.excluirAlerta(usuarioId, alertaId);
  }
}
