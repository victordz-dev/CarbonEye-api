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
import { Alerta } from '../../entities/alerta.entity';
import {
  GeoService,
  Coordenada,
  coordenadasParaWktPolygon,
  isDentroDoBrasil,
  isExatamenteNoBrasil,
} from '../geo/geo.service';
import { SiriService } from '../siri/siri.service';
import { IntegrationsService } from '../integrations/integrations.service';
import { LogsService } from '../logs/logs.service';
import { NivelLog, OrigemLog } from '../../entities/sistemalog.entity';
import { SalvarAreaDto } from './dto/salvar-area.dto';
import { AlternarMonitoramentoDto } from './dto/alternar-monitoramento.dto';
import { Polygon } from 'geojson';
import PDFDocument from 'pdfkit';

export interface AnalisarAreaResponse {
  status_territorial: string;
  classificacao_final: string;
  agro_polygon_id?: string;
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
  evi_atual?: number;
  ndwi_atual?: number;
  umidade_solo?: number;
  temp_solo?: number;
  imagem_satelite_truecolor?: string;
  imagem_satelite_ndvi?: string;
}

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
      const areaHa = areaM2 / 10000;

      // Valida teto mínimo por consulta: 1 hectare (10.000 m²) exigido pelo AgroMonitoring
      if (areaHa < 1) {
        throw new BadRequestException(
          `A área desenhada possui apenas ${areaHa.toFixed(2)} hectares. O tamanho mínimo suportado pelo satélite é de 1.00 hectare.`,
        );
      }

      // Check total global user quota (50ha)
      const totalAreaResult = await this.areaRepository.query(
        'SELECT SUM(ST_Area(geometria::geography)) as total_m2 FROM areas WHERE usuario_id = $1',
        [usuarioId]
      );
      const totalUserM2 = parseFloat(totalAreaResult[0]?.total_m2 || '0');
      const totalUserHa = totalUserM2 / 10000;

      if (totalUserHa + areaHa > 50) {
        throw new BadRequestException(
          `Cota global excedida. Você já possui ${totalUserHa.toFixed(2)} ha salvos. O limite da conta é de 50 ha.`,
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
      polyId = await this.integrationsService.criarPoligono(
        coords,
        mockName,
      );
      
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
        this.logger.log(`Rollback: Deletando polígono ${polyId} devido à falha na análise.`);
        await this.integrationsService.deletarPoligono(polyId).catch(e => 
          this.logger.error(`Falha no rollback do polígono ${polyId}: ${e.message}`)
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
    try {
      const dentroBrasil = await isExatamenteNoBrasil(dto.poligono);
      if (!dentroBrasil) {
        throw new BadRequestException(
          'O polígono desenhado possui coordenadas fora do território brasileiro. Esta aplicação restringe o monitoramento estritamente ao Brasil.',
        );
      }

      const wkt = coordenadasParaWktPolygon(dto.poligono);

      // 2. Calcula e valida área novamente antes de salvar (defesa)
      const areaResult = (await this.areaRepository.query(
        'SELECT ST_Area(ST_GeomFromText($1, 4326)::geography) as area_m2',
        [wkt],
      )) as unknown as { area_m2: string }[];
      const areaM2 = parseFloat(areaResult[0].area_m2);
      const areaHa = areaM2 / 10000;

      if (areaHa < 1) {
        throw new BadRequestException(
          'A área é menor que o limite mínimo de 1 hectare suportado pelo satélite.',
        );
      }

      // Check total global user quota (50ha)
      const totalAreaResult = await this.areaRepository.query(
        'SELECT SUM(ST_Area(geometria::geography)) as total_m2 FROM areas WHERE usuario_id = $1',
        [usuarioId]
      );
      const totalUserM2 = parseFloat(totalAreaResult[0]?.total_m2 || '0');
      const totalUserHa = totalUserM2 / 10000;

      if (totalUserHa + areaHa > 50) {
        throw new BadRequestException(
          `Cota global excedida. Você já possui ${totalUserHa.toFixed(2)} ha salvos. O limite da conta é de 50 ha.`,
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
      let polyId = dto.agro_polygon_id;
      if (!polyId) {
        polyId = await this.integrationsService.criarPoligono(
          dto.poligono,
          dto.nome,
        );
      }
      
      let siri = dto.siri_completo;
      if (!siri) {
        siri = await this.siriService.calcularSiri(dto.poligono, polyId);
      }

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

      // 7. Salva snapshot e remove da API AgroMonitoring se não for para manter ativo
      if (!dto.monitoramento_ativo && polyId) {
        try {
          const snapshot = await this.gerarSnapshot(polyId, dto.poligono);
          areaSalva.snapshotDetalhes = snapshot;
          await this.areaRepository.save(areaSalva);
          await this.integrationsService.deletarPoligono(polyId);
        } catch (e) {
          console.warn('Falha ao deletar polígono descartável na API:', e);
        }
      }

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

    const geoResult = await this.areaRepository.query(
      'SELECT ST_AsGeoJSON(geometria) as geojson FROM areas WHERE id = $1',
      [area.id]
    );
    const geojson = JSON.parse(geoResult[0].geojson);
    const coords: Coordenada[] = geojson.coordinates[0].map((pt: number[]) => ({
      longitude: pt[0],
      latitude: pt[1],
    }));

    if (area.monitoramentoAtivo === false && area.snapshotDetalhes) {
      return area.snapshotDetalhes;
    }

    return this.gerarSnapshot(area.agroPolygonId || '', coords);
  }

  private async gerarSnapshot(agroPolygonId: string, coords: Coordenada[]): Promise<HistoricoAreaResponse> {
    if (!agroPolygonId) {
      return {
        linha_do_tempo_ndvi: [],
        ocorrencias_incendio: 0,
        imagem_satelite_truecolor: 'https://picsum.photos/id/10/400/300',
        imagem_satelite_ndvi: 'https://picsum.photos/id/10/400/300',
      };
    }

    const rawNdviValores = await this.integrationsService.obterHistoricoNdvi(agroPolygonId);
    const indicesExtra = await this.integrationsService.obterIndicesRecentes(agroPolygonId);
    const dadosSolo = await this.integrationsService.obterDadosSolo(agroPolygonId);
    const quantidadeFocos = await this.geoService.obterQuantidadeFocosNoEntorno(coords, 12);

    const ndviMensalMap = new Map<string, { soma: number; qtd: number }>();
    
    rawNdviValores.forEach((item) => {
      if (item.valor >= 0.1) {
        const d = new Date(item.dataUnix * 1000);
        const mesAno = d.toISOString().substring(0, 7) + '-01'; 
        
        const atual = ndviMensalMap.get(mesAno) || { soma: 0, qtd: 0 };
        ndviMensalMap.set(mesAno, {
          soma: atual.soma + item.valor,
          qtd: atual.qtd + 1,
        });
      }
    });

    const ndviTimeline = Array.from(ndviMensalMap.entries())
      .map(([data, stats]) => ({
        data,
        valor: parseFloat((stats.soma / stats.qtd).toFixed(2)),
      }))
      .sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime());

    return {
      linha_do_tempo_ndvi: ndviTimeline,
      ocorrencias_incendio: quantidadeFocos,
      evi_atual: indicesExtra.evi,
      ndwi_atual: indicesExtra.ndwi,
      umidade_solo: dadosSolo.umidade,
      temp_solo: dadosSolo.tempSuperficie,
      imagem_satelite_truecolor: 'https://picsum.photos/id/10/400/300',
      imagem_satelite_ndvi: 'https://picsum.photos/id/10/400/300',
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

    if (!dto.monitoramento_ativo && area.monitoramentoAtivo) {
      // Obter coordenadas para gerar o snapshot
      const geoResult = await this.areaRepository.query(
        'SELECT ST_AsGeoJSON(geometria) as geojson FROM areas WHERE id = $1',
        [area.id]
      );
      const geojson = JSON.parse(geoResult[0].geojson);
      const coords: Coordenada[] = geojson.coordinates[0].map((pt: number[]) => ({
        longitude: pt[0],
        latitude: pt[1],
      }));

      // Gera o snapshot
      try {
        const snapshot = await this.gerarSnapshot(area.agroPolygonId || '', coords);
        area.snapshotDetalhes = snapshot;
      } catch (e) {
        console.warn('Não foi possível gerar o snapshot ao desativar monitoramento', e);
      }

      // Exclui da API para economizar limites
      if (area.agroPolygonId) {
        try {
          await this.integrationsService.deletarPoligono(area.agroPolygonId);
        } catch (e) {
          console.warn('Falha ao deletar polígono da API no alternarMonitoramento:', e);
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

    const geoResult = await this.areaRepository.query(
      'SELECT ST_AsGeoJSON(geometria) as geojson FROM areas WHERE id = $1',
      [area.id]
    );
    const geojson = JSON.parse(geoResult[0].geojson);
    const coords: Coordenada[] = geojson.coordinates[0].map((pt: number[]) => ({
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
          (a, b) => b.criadoEm.getTime() - a.criadoEm.getTime(),
        );
        const hist = ordenado[0];
        doc.moveDown(0.5);
        doc
          .font('Helvetica-Bold')
          .text('Detalhamento dos Indicadores Ambientais:');
        doc.font('Helvetica');
        doc.text(`- Cobertura Vegetal (NDVI): ${hist.notaVegetacao} / 45`);
        doc.text(
          `- Histórico e Degradação (NDVI Sazonal): ${hist.notaHistoricoNdvi} / 30`,
        );
        doc.text(
          `- Risco de Incêndios (Histórico & FIRMS 10km): ${hist.notaIncendios} / 20`,
        );
        doc.text(
          `- Condição Climática (Temperatura & Umidade): ${hist.notaClima} / 5`,
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

    if (area.agroPolygonId) {
      await this.integrationsService.deletarPoligono(area.agroPolygonId);
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
      { tipo: 'FOGO', msg: 'ALERTA CRÍTICO DA NASA (FIRMS): Detecção de múltiplos focos de calor nas últimas 2 horas no entorno do seu polígono. Risco de incêndio iminente.' },
      { tipo: 'DEGRADACAO', msg: 'ALERTA DO SATÉLITE: Queda brusca no NDVI detectada na passagem de hoje. Indícios de desmatamento ou supressão vegetal acelerada.' },
      { tipo: 'CLIMA', msg: 'ALERTA CLIMÁTICO (OpenWeather): Condições extremas de baixa umidade e alta temperatura identificadas na área, elevando o risco de perdas agrícolas e incêndios secundários.' }
    ];

    const alertaFalso = mockAlertas[Math.floor(Math.random() * mockAlertas.length)];

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
