import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

// Manual dependency-free dotenv loader
function loadEnv(): void {
  const envPath = path.join(__dirname, '..', '.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let value = match[2] || '';
        if (value.startsWith('"') && value.endsWith('"')) {
          value = value.slice(1, -1);
        } else if (value.startsWith("'") && value.endsWith("'")) {
          value = value.slice(1, -1);
        }
        process.env[key] = value.trim();
      }
    }
  }
}

loadEnv();

const agroApiKey = process.env.AGROMONITORING_API_KEY;
const firmsMapKey = process.env.NASA_FIRMS_MAP_KEY;
const weatherApiKey = process.env.OPENWEATHER_API_KEY;

async function testApiIntegrations(): Promise<void> {
  console.log('=== Iniciando Teste de Integração de APIs Externas ===\n');

  console.log(
    `Chave AgroMonitoring: ${agroApiKey ? 'Configurada' : 'Ausente'}`,
  );
  console.log(`Chave NASA FIRMS: ${firmsMapKey ? 'Configurada' : 'Ausente'}`);
  console.log(
    `Chave OpenWeather: ${weatherApiKey ? 'Configurada' : 'Ausente'}\n`,
  );

  // 1. Testar OpenWeatherMap
  if (weatherApiKey) {
    try {
      console.log('1. Testando OpenWeatherMap API...');
      const response = await axios.get<{
        name: string;
        main: { temp: number; humidity: number };
      }>(
        `https://api.openweathermap.org/data/2.5/weather?lat=-22.9068&lon=-47.0613&appid=${weatherApiKey}&units=metric`,
      );
      console.log('✅ OpenWeatherMap OK!');
      console.log(`   Localização: ${response.data.name}`);
      console.log(`   Temperatura: ${response.data.main.temp}°C`);
      console.log(`   Umidade: ${response.data.main.humidity}%\n`);
    } catch (e: unknown) {
      const errMsg =
        (e as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || (e as Error).message;
      console.log(`❌ Erro no OpenWeatherMap: ${errMsg}\n`);
    }
  } else {
    console.log('⚠️ Ignorando OpenWeatherMap (Sem chave).\n');
  }

  // 2. Testar AgroMonitoring
  if (agroApiKey) {
    try {
      console.log('2. Testando AgroMonitoring API (Listar Polígonos)...');
      const response = await axios.get<unknown[]>(
        `http://api.agromonitoring.com/agro/1.0/polygons?appid=${agroApiKey}`,
      );
      console.log('✅ AgroMonitoring OK!');
      console.log(
        `   Polígonos cadastrados na conta: ${Array.isArray(response.data) ? response.data.length : 0}\n`,
      );
    } catch (e: unknown) {
      const errMsg =
        (e as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || (e as Error).message;
      console.log(`❌ Erro no AgroMonitoring: ${errMsg}\n`);
    }
  } else {
    console.log('⚠️ Ignorando AgroMonitoring (Sem chave).\n');
  }

  // 3. Testar NASA FIRMS
  if (firmsMapKey) {
    try {
      console.log('3. Testando NASA FIRMS API (BBox SP - formato CSV)...');
      const bboxStr = '-47.1,-23.0,-46.9,-22.8'; // Bounding box ao redor de Campinas/SP
      const response = await axios.get<string>(
        `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${firmsMapKey}/VIIRS_SNPP_NRT/${bboxStr}/1`,
      );
      console.log('✅ NASA FIRMS OK!');
      const lines = response.data.split('\n');
      console.log(
        `   Linhas retornadas (incluindo cabeçalho): ${lines.length}`,
      );
      if (lines.length > 1) {
        console.log(`   Cabeçalho: ${lines[0].trim()}`);
        if (lines[1].trim()) {
          console.log(`   Exemplo de Foco: ${lines[1].trim()}`);
        }
      }
      console.log();
    } catch (e: unknown) {
      const errMsg =
        (e as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || (e as Error).message;
      console.log(`❌ Erro no NASA FIRMS: ${errMsg}\n`);
    }
  } else {
    console.log('⚠️ Ignorando NASA FIRMS (Sem chave).\n');
  }

  console.log('=== Teste de Integração Concluído ===');
}

void testApiIntegrations();
