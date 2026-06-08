import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DataSource, DeepPartial, Repository } from 'typeorm';
import { FocoIncendio } from './entities/focoincendio.entity';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';



async function importQueimadasStream(
  filePath: string,
  focoRepo: Repository<FocoIncendio>,
  limit: number = 100000,
) {
  const stats = fs.statSync(filePath);
  const estimatedLines = Math.floor(stats.size / 105); // estimativa de tamanho médio por linha no CSV
  const step = limit > 0 && estimatedLines > limit ? Math.floor(estimatedLines / limit) : 1;

  console.log(`Tamanho do arquivo: ${(stats.size / (1024 * 1024)).toFixed(2)} MB`);
  console.log(`Estimativa de linhas totais: ${estimatedLines}`);
  console.log(`Amostragem: Lendo 1 a cada ${step} registros para garantir amostragem uniforme ao longo do ano.`);

  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  let headers: string[] = [];
  let latIdx = -1;
  let lonIdx = -1;
  let dateIdx = -1;
  let satIdx = -1;
  let confIdx = -1;

  let lineCount = 0;
  let count = 0;
  let batch: DeepPartial<FocoIncendio>[] = [];
  const BATCH_SIZE = 5000;

  for await (const line of rl) {
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;

    if (headers.length === 0) {
      // Extrai os cabeçalhos
      headers = trimmedLine
        .toLowerCase()
        .split(',')
        .map((h) => h.trim());
      latIdx = headers.findIndex((h) => h === 'latitude' || h === 'lat');
      lonIdx = headers.findIndex((h) => h === 'longitude' || h === 'lon' || h === 'lng');
      dateIdx = headers.findIndex(
        (h) =>
          h === 'datahora' ||
          h === 'data_hora_gmt' ||
          h === 'acq_date' ||
          h === 'date',
      );
      satIdx = headers.findIndex((h) => h === 'satelite' || h === 'satellite');
      confIdx = headers.findIndex((h) => h === 'confianca' || h === 'confidence');

      if (latIdx === -1 || lonIdx === -1) {
        throw new Error(
          'CSV de queimadas inválido: colunas de latitude e longitude não encontradas.',
        );
      }
      continue;
    }

    lineCount++;
    // Se amostragem estiver ativa, ignora linhas intermediárias
    if (step > 1 && lineCount % step !== 0) {
      continue;
    }

    const columns = trimmedLine
      .split(',')
      .map((c) => c.trim().replace(/^["']|["']$/g, ''));
    if (columns.length <= Math.max(latIdx, lonIdx)) continue;

    const lat = parseFloat(columns[latIdx]);
    const lon = parseFloat(columns[lonIdx]);
    if (isNaN(lat) || isNaN(lon)) continue;

    let date = new Date();
    if (dateIdx !== -1 && columns[dateIdx]) {
      date = new Date(columns[dateIdx].replace(/\//g, '-'));
    }

    const satelite = satIdx !== -1 && columns[satIdx] ? columns[satIdx] : 'VIIRS';
    const confianca = confIdx !== -1 && columns[confIdx] ? parseInt(columns[confIdx], 10) : 80;

    batch.push({
      data: date,
      satelite,
      confianca: isNaN(confianca) ? 80 : confianca,
      geometria: {
        type: 'Point' as const,
        coordinates: [lon, lat],
      },
    });

    count++;

    if (batch.length >= BATCH_SIZE) {
      await focoRepo.save(batch);
      console.log(`-> Progresso: ${count} focos de calor inseridos...`);
      batch = [];
    }

    if (limit > 0 && count >= limit) {
      console.log(`⚠️ Limite de segurança de ${limit} registros atingido.`);
      break;
    }
  }

  // Insere os registros restantes
  if (batch.length > 0) {
    await focoRepo.save(batch);
    console.log(`-> Progresso: ${count} focos de calor inseridos...`);
  }

  console.log(`✅ Sucesso: ${count} focos de incêndio foram sincronizados no PostGIS.`);
}

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const dataSource = app.get(DataSource);
  const focoRepo = dataSource.getRepository(FocoIncendio);

  console.log('🧹 Limpando tabela de focos de incêndio antigos...');
  await focoRepo.clear();

  const resourcesDir = path.join(__dirname, 'resources');
  let csvPath = '';

  if (fs.existsSync(resourcesDir)) {
    const files = fs.readdirSync(resourcesDir);
    // Tenta encontrar o arquivo oficial grande adicionado pelo usuário
    const bdqueimadasFile = files.find(
      (f) => f.endsWith('.csv') && f.startsWith('bdqueimadas'),
    );
    if (bdqueimadasFile) {
      csvPath = path.join(resourcesDir, bdqueimadasFile);
    } else {
      // Fallback para o default
      const defaultCsv = files.find(
        (f) => f.endsWith('.csv') && f.startsWith('focos_historicos'),
      );
      if (defaultCsv) {
        csvPath = path.join(resourcesDir, defaultCsv);
      }
    }
  }

  const jsonPath = path.join(resourcesDir, 'focos_historicos.json');

  if (csvPath && fs.existsSync(csvPath)) {
    console.log('🚀 Iniciando importação via Stream do arquivo CSV...');
    // Se for o CSV grande do BDQueimadas, limitamos a 1M para popular o Supabase inteiro.
    // O algoritmo fará amostragem pegando focos ao longo do ano todo.
    const isBigFile = path.basename(csvPath).startsWith('bdqueimadas');
    const importLimit = isBigFile ? 1000000 : 0;
    await importQueimadasStream(csvPath, focoRepo, importLimit);
  } else if (fs.existsSync(jsonPath)) {
    console.log('🚀 Detectado arquivo JSON fallback. Importando focos...');
    const rawData = fs.readFileSync(jsonPath, 'utf8');
    const parsedData = JSON.parse(rawData) as Array<{
      longitude: number;
      latitude: number;
      monthsAgo: number;
      satelite: string;
      confianca: number;
    }>;
    const firePoints = parsedData.map((item) => {
      const d = new Date();
      const now = new Date();
      d.setMonth(now.getMonth() - item.monthsAgo);
      return {
        data: d,
        satelite: item.satelite,
        confianca: item.confianca,
        geometria: {
          type: 'Point' as const,
          coordinates: [item.longitude, item.latitude],
        },
      };
    });
    await focoRepo.save(firePoints);
    console.log(`✅ Sucesso: ${firePoints.length} focos do JSON inseridos.`);
  } else {
    console.log(
      '⚠️ Nenhum arquivo de dados históricos de focos encontrado para seeding.',
    );
  }

  console.log('🎉 Processo de Seeding concluído!');
  await app.close();
}

bootstrap().catch((err) => {
  console.error('❌ Erro durante o Seeding:', err);
  process.exit(1);
});
