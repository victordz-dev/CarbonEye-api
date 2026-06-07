import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Area } from '../../entities/area.entity';
import { HistoricoSiri } from '../../entities/historicosiri.entity';
import {
  GeoService,
  Coordenada,
  coordenadasParaWktPolygon,
} from '../geo/geo.service';
import { SiriService } from '../siri/siri.service';
import { IntegrationsService } from '../integrations/integrations.service';
import { SalvarAreaDto } from './dto/salvar-area.dto';
import { AlternarMonitoramentoDto } from './dto/alternar-monitoramento.dto';
import { Polygon } from 'geojson';
import PDFDocument from 'pdfkit';

export interface AnalisarAreaResponse {
  status_territorial: string;
  classificacao_final: string;
  siri?: {
    pontuacao_total: number;
    detalhes: {
      vegetacao: number;
      historico: number;
      incendios: number;
      clima: number;
    };
  };
  area_m2?: number;
  clima_atual?: {
    temp: number;
    umidade: number;
  };
  imagem_satelite_url?: string;
  motivo?: string;
}

export interface HistoricoAreaResponse {
  linha_do_tempo_ndvi: Array<{ data: string; valor: number }>;
  ocorrencias_incendio: number;
}

@Injectable()
export class AreasService {
  private readonly logger = new Logger(AreasService.name);

  constructor(
    @InjectRepository(Area)
    private readonly areaRepository: Repository<Area>,
    @InjectRepository(HistoricoSiri)
    private readonly historicoRepository: Repository<HistoricoSiri>,
    private readonly geoService: GeoService,
    private readonly siriService: SiriService,
    private readonly integrationsService: IntegrationsService,
  ) {}

  /**
   * Realiza a análise preliminar (triagem) da área desenhada.
   * Não salva no banco de dados e calcula limites e PostGIS.
   */
  async analisarArea(
    usuarioId: string,
    coords: Coordenada[],
  ): Promise<AnalisarAreaResponse> {
    try {
      const wkt = coordenadasParaWktPolygon(coords);

      // 1. Calcula o tamanho do polígono no PostGIS
      const areaResult = (await this.areaRepository.query(
        'SELECT ST_Area(ST_GeomFromText($1, 4326)::geography) as area_m2',
        [wkt],
      )) as unknown as { area_m2: string }[];
      const areaM2 = parseFloat(areaResult[0].area_m2);
      const areaHa = areaM2 / 10000;

      // Valida teto máximo por consulta: 10 hectares (100.000 m²)
      if (areaHa > 10) {
        throw new BadRequestException(
          `A área desenhada possui ${areaHa.toFixed(2)} hectares e excede o limite máximo de 10 hectares por consulta.`,
        );
      }

      // 2. Valida cotas de consumo mensal do usuário (4 consultas e 40 hectares no total)
      const inicioMes = new Date();
      inicioMes.setDate(1);
      inicioMes.setHours(0, 0, 0, 0);

      const countResult = (await this.areaRepository.query(
        `SELECT COUNT(*) as total, COALESCE(SUM(ST_Area(geometria::geography)), 0) as total_area_m2
         FROM areas
         WHERE usuario_id = $1 AND criado_em >= $2`,
        [usuarioId, inicioMes],
      )) as unknown as { total: string; total_area_m2: string }[];
      const totalConsultas = parseInt(countResult[0].total, 10);
      const totalAreaConsumidaHa =
        parseFloat(countResult[0].total_area_m2) / 10000;

      if (totalConsultas >= 4) {
        throw new BadRequestException('Limite mensal de 4 consultas atingido.');
      }
      if (totalAreaConsumidaHa + areaHa > 40) {
        throw new BadRequestException(
          `Esta consulta consumiria ${areaHa.toFixed(2)} ha, ultrapassando seu limite mensal restante de ${(40 - totalAreaConsumidaHa).toFixed(2)} ha.`,
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
      const polyId = await this.integrationsService.criarPoligono(
        coords,
        mockName,
      );
      const siri = await this.siriService.calcularSiri(coords, polyId);
      const sateliteUrl =
        await this.integrationsService.obterImagemSateliteRecente(polyId);

      return {
        status_territorial: 'LIVRE',
        classificacao_final: siri.classificacao,
        siri: {
          pontuacao_total: siri.pontuacaoTotal,
          detalhes: siri.detalhes,
        },
        area_m2: parseFloat(areaM2.toFixed(1)),
        clima_atual: {
          temp: siri.climaAtual.temp,
          umidade: siri.climaAtual.umidade,
        },
        imagem_satelite_url: sateliteUrl,
      };
    } catch (error) {
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
    try {
      // 1. Validar limites de monitoramento contínuo (máximo de 2 ativos)
      if (dto.monitoramento_ativo) {
        const countAtivos = await this.areaRepository.count({
          where: { usuarioId, monitoramentoAtivo: true },
        });
        if (countAtivos >= 2) {
          throw new BadRequestException(
            'Você já possui 2 mapas em monitoramento contínuo ativo. Pause um deles para prosseguir.',
          );
        }
      }

      const wkt = coordenadasParaWktPolygon(dto.poligono);

      // 2. Calcula e valida área novamente antes de salvar (defesa)
      const areaResult = (await this.areaRepository.query(
        'SELECT ST_Area(ST_GeomFromText($1, 4326)::geography) as area_m2',
        [wkt],
      )) as unknown as { area_m2: string }[];
      const areaM2 = parseFloat(areaResult[0].area_m2);
      const areaHa = areaM2 / 10000;

      if (areaHa > 10) {
        throw new BadRequestException(
          'A área excede o limite máximo de 10 hectares.',
        );
      }

      // 3. Validação territorial (defesa)
      const sobreposicao = await this.geoService.verificarSobreposicao(
        dto.poligono,
      );
      if (sobreposicao.intercepta) {
        throw new BadRequestException(
          'Não é permitido salvar áreas que sobreponham territórios protegidos.',
        );
      }

      // 4. Criação definitiva no AgroMonitoring
      const polyId = await this.integrationsService.criarPoligono(
        dto.poligono,
        dto.nome,
      );
      const siri = await this.siriService.calcularSiri(dto.poligono, polyId);

      // Converte coordenadas para o formato GeoJSON Polygon
      const formattedCoords = dto.poligono.map((c) => [
        c.longitude,
        c.latitude,
      ]);
      if (formattedCoords[0] !== formattedCoords[formattedCoords.length - 1]) {
        formattedCoords.push(formattedCoords[0]);
      }
      const geometria: Polygon = {
        type: 'Polygon',
        coordinates: [formattedCoords],
      };

      // 5. Persiste a área no banco
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

      const areaSalva = await this.areaRepository.save(novaArea);

      // 6. Persiste o registro de histórico SIRI inicial
      const historico = this.historicoRepository.create({
        areaId: areaSalva.id,
        notaVegetacao: siri.detalhes.vegetacao,
        notaHistoricoNdvi: siri.detalhes.historico,
        notaIncendios: siri.detalhes.incendios,
        notaClima: siri.detalhes.clima,
        pontuacaoTotal: siri.pontuacaoTotal,
        classificacaoGeral: siri.classificacao,
      });
      await this.historicoRepository.save(historico);

      const ativosCount = await this.areaRepository.count({
        where: { usuarioId, monitoramentoAtivo: true },
      });

      return {
        id: areaSalva.id,
        mensagem: `Área salva com sucesso. ${ativosCount} de 2 mapas em monitoramento.`,
      };
    } catch (error) {
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

    const coords: Coordenada[] = area.geometria.coordinates[0].map((pt) => ({
      longitude: pt[0],
      latitude: pt[1],
    }));

    const ndviValores = await this.integrationsService.obterHistoricoNdvi(
      area.agroPolygonId || '',
    );
    const quantidadeFocos = await this.geoService.obterQuantidadeFocosNoEntorno(
      coords,
      12,
    );

    // Mapeia o histórico de NDVI com datas retroativas simuladas para o gráfico do mobile
    const hoje = new Date();
    const ndviTimeline = ndviValores.map((valor, idx) => {
      const d = new Date();
      d.setMonth(hoje.getMonth() - (ndviValores.length - 1 - idx));
      return {
        data: d.toISOString().substring(0, 7) + '-01',
        valor: parseFloat(valor.toFixed(2)),
      };
    });

    return {
      linha_do_tempo_ndvi: ndviTimeline,
      ocorrencias_incendio: quantidadeFocos,
    };
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

    area.monitoramentoAtivo = dto.monitoramento_ativo;
    await this.areaRepository.save(area);

    return {
      mensagem: dto.monitoramento_ativo
        ? 'Monitoramento ativado com sucesso.'
        : 'Monitoramento pausado com sucesso.',
    };
  }

  /**
   * Gera o laudo da área em formato PDF
   */
  async gerarLaudoPdf(usuarioId: string, areaId: string): Promise<Buffer> {
    const area = await this.areaRepository.findOne({
      where: { id: areaId, usuarioId },
      relations: ['usuario', 'historicosSiri'],
    });

    if (!area) {
      throw new NotFoundException('Área não encontrada.');
    }

    const coords: Coordenada[] = area.geometria.coordinates[0].map((pt) => ({
      longitude: pt[0],
      latitude: pt[1],
    }));
    const wkt = coordenadasParaWktPolygon(coords);

    const areaResult = (await this.areaRepository.query(
      'SELECT ST_Area(ST_GeomFromText($1, 4326)::geography) as area_m2',
      [wkt],
    )) as unknown as { area_m2: string }[];
    const areaM2 = parseFloat(areaResult[0].area_m2);
    const areaHa = areaM2 / 10000;

    return new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', (err: Error) => reject(err));

      // Logo/Header
      doc
        .fillColor('#0284c7')
        .fontSize(24)
        .font('Helvetica-Bold')
        .text('CarbonEye', { align: 'center' });
      doc
        .fillColor('#475569')
        .fontSize(12)
        .font('Helvetica-Oblique')
        .text('Monitoramento Territorial e Risco Ambiental', {
          align: 'center',
        });
      doc.moveDown(1);

      // Linha separadora
      doc
        .strokeColor('#e2e8f0')
        .lineWidth(2)
        .moveTo(50, doc.y)
        .lineTo(562, doc.y)
        .stroke();
      doc.moveDown(1.5);

      // Informações Gerais
      doc
        .fillColor('#0f172a')
        .fontSize(16)
        .font('Helvetica-Bold')
        .text('1. Informações Gerais da Área');
      doc.moveDown(0.5);

      doc.fontSize(10).font('Helvetica').fillColor('#334155');
      doc.text(`Identificador: ${area.id}`);
      doc.text(`Nome da Área: ${area.nome}`);
      doc.text(`Proprietário: ${area.usuario.nome} (${area.usuario.email})`);
      doc.text(`Data de Criação: ${area.criadoEm.toLocaleDateString('pt-BR')}`);
      doc.text(
        `Área Total: ${areaHa.toFixed(2)} ha (${areaM2.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} m²)`,
      );
      doc.text(
        `Monitoramento Contínuo: ${area.monitoramentoAtivo ? 'Ativo' : 'Inativo'}`,
      );
      doc.moveDown(1.5);

      // Status Ambiental (SIRI)
      doc
        .fillColor('#0f172a')
        .fontSize(16)
        .font('Helvetica-Bold')
        .text('2. Diagnóstico Ambiental - Índice SIRI');
      doc.moveDown(0.5);

      const statusCls = area.classificacaoAtual || 'Não Classificado';
      const pontuacao = area.siriAtual ?? 0;

      doc.fontSize(10).font('Helvetica').fillColor('#334155');
      doc
        .text(`Pontuação Consolidada: `)
        .font('Helvetica-Bold')
        .text(`${pontuacao} / 100`, { continued: false });
      doc
        .font('Helvetica')
        .text(`Classificação Final: `)
        .font('Helvetica-Bold')
        .text(statusCls, { continued: false });
      doc.font('Helvetica');

      // Detalhamento do histórico
      if (area.historicosSiri && area.historicosSiri.length > 0) {
        // Encontra o histórico mais recente
        const ordenado = [...area.historicosSiri].sort(
          (a, b) => b.dataCalculo.getTime() - a.dataCalculo.getTime(),
        );
        const hist = ordenado[0];
        doc.moveDown(0.5);
        doc
          .font('Helvetica-Bold')
          .text('Detalhamento dos Indicadores Ambientais:');
        doc.font('Helvetica');
        doc.text(`- Cobertura Vegetal (NDVI): ${hist.notaVegetacao} / 100`);
        doc.text(
          `- Histórico e Degradação (NDVI Sazonal): ${hist.notaHistoricoNdvi} / 100`,
        );
        doc.text(
          `- Risco de Incêndios (Histórico & FIRMS 10km): ${hist.notaIncendios} / 100`,
        );
        doc.text(
          `- Condição Climática (Temperatura & Umidade): ${hist.notaClima} / 100`,
        );
      }
      doc.moveDown(1.5);

      // Coordenadas
      doc
        .fillColor('#0f172a')
        .fontSize(16)
        .font('Helvetica-Bold')
        .text('3. Delimitação Geográfica');
      doc.moveDown(0.5);

      doc.fontSize(9).font('Helvetica-Bold').text('Vértices do Polígono:');
      doc.font('Helvetica').fillColor('#475569');
      coords.forEach((c, idx) => {
        doc.text(
          `Ponto ${idx + 1}: Longitude ${c.longitude.toFixed(6)}, Latitude ${c.latitude.toFixed(6)}`,
        );
      });
      doc.moveDown(2);

      // Disclaimer
      doc
        .strokeColor('#e2e8f0')
        .lineWidth(1)
        .moveTo(50, doc.y)
        .lineTo(562, doc.y)
        .stroke();
      doc.moveDown(1);
      doc
        .fontSize(8)
        .fillColor('#64748b')
        .text(
          'Este laudo tem finalidade acadêmica e de triagem preliminar com base em dados de sensoriamento remoto de acesso público. ' +
            'Não substitui laudos técnicos profissionais, auditorias ambientais em campo, vistorias presenciais ou pareceres oficiais das autoridades competentes.',
          { align: 'justify' },
        );

      doc.end();
    });
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

    await this.areaRepository.remove(area);
    return { mensagem: 'Área excluída com sucesso.' };
  }
}
