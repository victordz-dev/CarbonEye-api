import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Res,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AreasService } from './areas.service';
import {
  AnalisarAreaResponse,
  HistoricoAreaResponse,
} from './areas.interfaces';
import { AnalisarAreaDto } from './dto/analisar-area.dto';
import { SalvarAreaDto } from './dto/salvar-area.dto';
import { AlternarMonitoramentoDto } from './dto/alternar-monitoramento.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GetUser } from '../../decorators/get-user.decorator';
import { Area } from '../../entities/area.entity';
import type { Response } from 'express';
import { LaudoPdfService } from './laudo-pdf.service';

@ApiTags('Areas')
@ApiBearerAuth()
@Controller('areas')
@UseGuards(JwtAuthGuard)
export class AreasController {
  constructor(
    private readonly areasService: AreasService,
    private readonly laudoPdfService: LaudoPdfService,
  ) {}

  @Post('analisar')
  @HttpCode(HttpStatus.OK)
  async analisarArea(
    @GetUser('id') usuarioId: string,
    @Body() dto: AnalisarAreaDto,
  ): Promise<AnalisarAreaResponse> {
    return this.areasService.analisarArea(usuarioId, dto.poligono);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async salvarArea(
    @GetUser('id') usuarioId: string,
    @Body() dto: SalvarAreaDto,
  ): Promise<{ id: string; mensagem: string }> {
    return this.areasService.salvarArea(usuarioId, dto);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  async listarAreas(@GetUser('id') usuarioId: string): Promise<Area[]> {
    return this.areasService.listarAreas(usuarioId);
  }

  @Get(':id/historico')
  @HttpCode(HttpStatus.OK)
  async obterHistoricoArea(
    @GetUser('id') usuarioId: string,
    @Param('id') areaId: string,
  ): Promise<HistoricoAreaResponse> {
    return this.areasService.obterHistoricoArea(usuarioId, areaId);
  }

  @Get(':id/laudo-pdf')
  @HttpCode(HttpStatus.OK)
  async obterLaudoPdf(
    @GetUser('id') usuarioId: string,
    @Param('id') areaId: string,
    @Res() res: Response,
  ): Promise<void> {
    const pdfBuffer = await this.laudoPdfService.gerarLaudoPdf(
      usuarioId,
      areaId,
    );
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="laudo-siri-${areaId}.pdf"`,
      'Content-Length': pdfBuffer.length,
    });
    res.end(pdfBuffer);
  }

  @Patch(':id/monitoramento')
  @HttpCode(HttpStatus.OK)
  async alternarMonitoramento(
    @GetUser('id') usuarioId: string,
    @Param('id') areaId: string,
    @Body() dto: AlternarMonitoramentoDto,
  ): Promise<{ mensagem: string }> {
    return this.areasService.alternarMonitoramento(usuarioId, areaId, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async excluirArea(
    @GetUser('id') usuarioId: string,
    @Param('id') areaId: string,
  ): Promise<{ mensagem: string }> {
    return this.areasService.excluirArea(usuarioId, areaId);
  }

  @Patch(':id/nome')
  @HttpCode(HttpStatus.OK)
  async renomearArea(
    @GetUser('id') usuarioId: string,
    @Param('id') areaId: string,
    @Body('nome') novoNome: string,
  ): Promise<{ mensagem: string }> {
    return this.areasService.renomearArea(usuarioId, areaId, novoNome);
  }

  @Post(':id/alertas/mock')
  @HttpCode(HttpStatus.CREATED)
  async criarAlertaMock(
    @GetUser('id') usuarioId: string,
    @Param('id') areaId: string,
  ): Promise<{ mensagem: string }> {
    return this.areasService.criarAlertaMock(usuarioId, areaId);
  }
}
