# 🛰️ CarbonEye - Backend (BFF)

O backend do **CarbonEye** é construído em NestJS com TypeScript e serve como um BFF (Backend For Frontend) robusto para a plataforma. Ele gerencia as validações espaciais geográficas usando PostGIS, realiza cache de dados climáticos via Redis e integra as APIs de monitoramento ambiental de forma segura.

---

## 👥 Integrantes do Grupo
* **Nome do Integrante 1** - RM: XXXXX
* **Nome do Integrante 2** - RM: XXXXX
* **Nome do Integrante 3** - RM: XXXXX
* **Nome do Integrante 4** - RM: XXXXX
* **Nome do Integrante 5** - RM: XXXXX

---

## 🌎 Alinhamento com os ODS da ONU
O projeto está diretamente conectado com a agenda de desenvolvimento sustentável global:
*   **ODS 13 (Ação Contra a Mudança Global do Clima):** Detecção de focos ativos de calor e análise de risco climático florestal.
*   **ODS 15 (Vida Terrestre):** Auxílio na fiscalização e proteção de biomas contra incêndios e degradações florestais.
*   **ODS 9 (Indústria, Inovação e Infraestrutura):** Aplicação prática de dados aeroespaciais no monitoramento terrestre.

---

## 🧠 Arquitetura e Integrações
O backend integra e processa dados das seguintes fontes:
1.  **Banco de Dados Espacial (PostGIS):** Realiza checagem geométrica ultrarrápida de polígonos usando `ST_Intersects` (para identificar se áreas invadem Terras Indígenas ou UCs) e `ST_DWithin` (para rastrear focos de calor no entorno das coordenadas monitoradas).
2.  **NASA FIRMS API:** Cron Job diário (`TasksModule`) que consome focos de queimada ativos do satélite em formato CSV.
3.  **AgroMonitoring API:** Obtém imagens de satélite do Sentinel-2/Landsat-8 e calcula históricos do índice de vegetação NDVI para monitorar a saúde das áreas.
4.  **OpenWeatherMap API:** Coleta dados climáticos atuais (temperatura, umidade, vento) e calcula o fator de risco de incêndio.
5.  **Cálculo do SIRI:** Lógica matemática integrada que normaliza todos os fatores em um índice de risco ecológico de 0 a 100.
6.  **Exportação em PDF:** Motor de PDF robusto para geração automática de relatórios e laudos ecológicos prontos para download.

---

## 🧱 Arquitetura de Pastas (Backend)

```txt
src/
 ├── config/         # Configurações de conexão de banco, Redis e APIs
 ├── entities/       # Definições de entidades TypeORM (Usuario, Area, HistoricoSiri, Alerta, TerritorioProtegido)
 ├── modules/        # Módulos encapsulados por recurso:
 │    ├── auth/          # Autenticação (JWT, Criptografia, Login)
 │    ├── geo/           # Consultas espaciais PostGIS e lógica geográfica
 │    ├── integrations/  # Integrações de APIs externas (NASA, AgroMonitoring, Weather)
 │    ├── pdf/           # Geração de laudos PDF estruturados
 │    └── tasks/         # Agendamentos de Cron Jobs (NASA FIRMS scanner)
 ├── seeder.ts       # Script de carga inicial de dados históricos
 └── main.ts         # Bootstrapping do servidor NestJS
```

---

## 🔧 Configuração e Execução

### Pré-requisitos
*   **Node.js** (versão 18 ou superior).
*   **Docker** instalado e ativo no sistema para rodar o PostgreSQL/PostGIS e o Redis.

### 1. Iniciar Banco de Dados e Cache (Docker Compose)
Na raiz da pasta `/backend`, suba os contêineres do banco e do cache local rodando:
```bash
docker-compose up -d
```
Isso criará uma instância PostgreSQL rodando na porta `5432` com suporte PostGIS, e um Redis na porta `6379`.

### 2. Configurar Variáveis de Ambiente
Duplique o arquivo `.env.example` e renomeie-o para `.env`:
```bash
cp .env.example .env
```
Preencha as chaves de API reais disponibilizadas no arquivo `.env`. Certifique-se de que a extensão PostGIS esteja habilitada no banco.

### 3. Instalar Dependências
```bash
npm install
```

### 4. Rodar Carga Inicial de Dados (Seeders)
Para popular o banco com o histórico de queimadas simulado do INPE (com base em dados históricos reais), execute:
```bash
npm run db:seed
```

### 5. Importar Dados de UCs e Terras Indígenas (CNUC/FUNAI via QGIS)
Como o backend está preparado para trabalhar com dados reais e oficiais:
1. Baixe os shapefiles oficiais no portal do **CNUC (MMA)** e da **FUNAI**.
2. Abra os arquivos no **QGIS**.
3. Conecte o QGIS ao seu banco de dados Postgres (local ou de produção/Render).
4. No **Gerenciador de Banco de Dados** (DB Manager) do QGIS, exporte as camadas do shapefile diretamente para a tabela `territorios_protegidos` mapeando a geometria para o campo `geom` e preenchendo `nome_reserva` e `tipo` (TI ou UC).

### 6. Executar o Servidor de Desenvolvimento
```bash
npm run start:dev
```
O servidor estará ativo em `http://localhost:3000`.

### 7. Documentação da API (Swagger)
Com o servidor rodando, você pode acessar a documentação interativa dos endpoints e testá-los diretamente pelo navegador:
* URL: `http://localhost:3000/api/docs`

---

## 🧪 Comandos de Testes e Lint
* Executar lint para analisar erros de tipagem/TypeScript:
  ```bash
  npm run lint
  ```
* Validar compilação do projeto:
  ```bash
  npm run build
  ```
