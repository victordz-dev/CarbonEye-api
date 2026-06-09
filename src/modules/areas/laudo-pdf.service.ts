import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Area } from '../../entities/area.entity';
import { GeoService } from '../geo/geo.service';
import { coordenadasParaWktPolygon } from '../geo/geo.utils';
import PDFDocument from 'pdfkit';
import { CONVERSAO_M2_HA } from './areas.constants';

@Injectable()
export class LaudoPdfService {
  constructor(
    @InjectRepository(Area)
    private readonly areaRepository: Repository<Area>,
    private readonly geoService: GeoService,
  ) {}

  async gerarLaudoPdf(usuarioId: string, areaId: string): Promise<Buffer> {
    const area = await this.areaRepository.findOne({
      where: { id: areaId, usuarioId },
      relations: ['usuario', 'historicosSiri'],
    });

    if (!area) {
      throw new NotFoundException('Área não encontrada.');
    }

    const coords = await this.geoService.extrairCoordenadasDaArea(area.id);
    const wkt = coordenadasParaWktPolygon(coords);

    const areaM2 = await this.geoService.calcularAreaM2(wkt);
    const areaHa = areaM2 / CONVERSAO_M2_HA;

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
}
