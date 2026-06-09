# Especificação Técnica e Arquitetura Backend (NestJS & PostGIS)

## 1. Visão Geral da Arquitetura
O backend do CarbonEye atua como o cérebro da plataforma e funciona no modelo de **BFF (Backend For Frontend)**. Desenvolvido sob o paradigma de Arquitetura Modular e Injeção de Dependências, ele centraliza cálculos matemáticos complexos, o geoprocessamento espacial territorial e atua como uma barreira de segurança (*Proxy*) entre o aplicativo mobile e os provedores de satélite terceirizados.

## 2. Stack Tecnológico e Infraestrutura
A camada de serviços foi projetada para garantir escalabilidade, tipagem forte e capacidade de realizar cálculos vetoriais em tempo real.

* **Framework Principal:** NestJS.
* **Linguagem:** TypeScript (Strict Mode).
* **Engenharia de Software (POO Avançada):** Implementação de Herança clássica utilizando uma `EntidadeBase` abstrata que propaga IDs e timestamps de criação (`criado_em`) genéricos para todas as tabelas (Usuario, Area, Alerta, HistoricoSiri, SistemaLog). Uso de **interfaces** e **tipos** para isolar contratos de dados, como a interface `Coordenada` e os tipos de resposta `SiriScoreResult` e `HistoricoAreaResponse`.
* **Banco de Dados Relacional:** PostgreSQL.
* **Motor Geoespacial:** Extensão PostGIS ativada no PostgreSQL, fundamental para os cálculos vetoriais.
* **Mapeamento Objeto-Relacional (ORM):** TypeORM para gerenciar conexões, entidades e migrações seguras via CLI (sem sincronização em produção), com uso de *Transactions* (`DataSource`) para garantir rollback em caso de falhas e proteger a consistência do banco de dados relacional.

## 3. Estrutura Modular (Domain-Driven Design - DDD)
O NestJS foi estruturado separando os domínios da aplicação, garantindo baixo acoplamento e alta coesão:

* **`AuthModule`:** Gerencia o fluxo de autenticação e geração de JWT.
* **`AreasModule`:** Responsável por receber o *Payload* do mobile e lidar com regras complexas, incluindo salvamento de "Snapshots" em JSONB quando o monitoramento de uma área é desativado (offline-history). Delega a geração de relatórios ao `LaudoPdfService` e a captura de dados históricos ao `SnapshotService`, garantindo o Princípio da Responsabilidade Única (SRP).
* **`GeoModule`:** Módulo core geoespacial. Contém as interfaces de tipos (`geo.types.ts`), funções utilitárias de geometria (`geo.utils.ts`) e o `GeoService` que centraliza toda a comunicação vetorial com o PostGIS, incluindo cálculos de área, extração de coordenadas, verificação de sobreposição territorial e validação de fronteira (reverse geocoding via Nominatim).
* **`SiriModule`:** O motor de cálculo. Recebe os dados de vegetação e incêndios para aplicar os pesos matemáticos. Contém utilitários compartilhados (`siri.utils.ts`) com a lógica de classificação por pontuação.
* **`IntegrationsModule`:** Módulo isolado contendo integrações específicas de satélite. Implementa Cache local (CacheModule in-memory) para otimizar chamadas pesadas ao histórico de áreas já consultadas.
* **`AlertasModule`:** Responsável pela injeção e gerência do fluxo de notificações do usuário, controlando estados de leitura e persistência.
* **`TasksModule`:** Orquestra os Cron Jobs de monitoramento contínuo (varredura SIRI semanal, monitoramento de clima/fogo por hora, garbage collector de polígonos e relatórios mensais) com processamento paralelo de concorrência controlada.
* **`LogsModule`:** Módulo global de auditoria que registra ações críticas na tabela `SistemaLog` com sanitização automática de campos sensíveis.
* **`NotificationsModule`:** Gerencia o envio de Push Notifications via Expo Push API.

## 4. Pipeline de Processamento e Tratamento de Dados
O tráfego de uma requisição segue um fluxo estrito de validação:

1. **Segurança HTTP (Middleware):** Helmet aplica cabeçalhos de segurança e o ThrottlerModule impõe rate limiting global (100 req/min por IP).
2. **Camada de Transporte (Controller):** Recebe a requisição HTTP. Parâmetros de rota `:id` são validados com `ParseUUIDPipe`.
3. **Validação Rigorosa (DTOs/Zod):** O payload é validado pelo `ZodValidationPipe` global usando DTOs Zod tipados que rejeitam dados malformados antes de prosseguir.
4. **Regra de Negócio (Service):** Dispara processos assíncronos e lógicas de negócio do domínio. Algumas requisições (como a geração de snapshots de histórico) paralelizam chamadas externas (`Promise.all()`) para máxima performance.
5. **Camada de Acesso a Dados (Repository/PostGIS):** Persiste os relatórios e entidades herdadas da `EntidadeBase` no TypeORM. O `GeoService` executa queries espaciais PostGIS para cálculos de área, interseção territorial e extração de coordenadas.

## 5. Orquestração de Integrações e Estratégia de Rede
A complexidade do backend do CarbonEye exige o tratamento cuidadoso das APIs externas. Contudo, em nome da performance da arquitetura, promoveu-se uma divisão de responsabilidades com o Front-end:

* **AgroMonitoring API:** O backend aciona o `POST /polygons` de forma segura. Apenas os polígonos validados geometricamente ganham acesso a essa requisição para poupar franquia do pacote em nuvem. O Backend processa o histórico vegetacional (NDVI) armazenando em cache.
* **NASA FIRMS:** Utilizada para detecção ativa de anomalias térmicas num raio de abrangência da área.
* **OpenWeather API:** Acionada pelo Backend durante a avaliação do SIRI e varredura noturna para incorporar índices climáticos atuais (temperatura e umidade) aos cálculos de risco.
* **Nominatim (OpenStreetMap):** Utilizada pelo `GeoService` para reverse geocoding, validando se o centroide do polígono está de fato no Brasil.

## 6. Monitoramento Contínuo e Alertas (Cron Jobs)
Para cumprir o requisito de monitoramento ativo:

* **Varredura SIRI Semanal (Domingo 00:00):** Recalcula o índice SIRI de todas as áreas monitoradas com processamento paralelo de concorrência controlada.
* **Monitoramento de Clima e Fogo (A cada hora):** Consulta NASA FIRMS por focos ativos e OpenWeather por condições climáticas extremas, emitindo alertas e Push Notifications automaticamente.
* **Garbage Collector (A cada hora):** Identifica e exclui polígonos órfãos na API AgroMonitoring (criados durante triagens mas não salvos no banco).
* **Relatórios Mensais (1º dia de cada mês):** Gera alertas de disponibilidade de relatório para cada área monitorada.
* **Motor de Testes (Mock Alerts):** Para possibilitar a homologação acadêmica na Global Solution, foi criada uma rota injetora de alertas simulados (`/areas/:id/alertas/mock`) que imita disparos críticos do satélite.

## 7. Segurança e Validação
* **Autenticação JWT:** Tokens JWT são validados por `JwtAuthGuard` com Passport. O secret é obrigatoriamente definido via variável de ambiente (fail-fast se ausente).
* **Herança Segura:** A propriedade das áreas é garantida pelo relacionamento FK vinculado ao Token (`@GetUser`), blindando consultas cruzadas.
* **Helmet:** Cabeçalhos HTTP de segurança (X-Content-Type-Options, X-Frame-Options, etc.).
* **Rate Limiting:** ThrottlerModule com limite global e throttle específico em endpoints sensíveis.
* **Validação de IDs:** `ParseUUIDPipe` em todos os parâmetros de rota `:id` para prevenir payloads maliciosos.
* **Tratamento de Erros:** O sistema intercepta erros sistêmicos por meio de um `AllExceptionsFilter` Global, garantindo que o Frontend receba apenas códigos HTTP formatados sem vazar metadados sensíveis do servidor.
* **Logs e Auditoria:** As ações críticas geram eventos na tabela `SistemaLog` persistida no PostgreSQL, com sanitização automática de campos sensíveis (senhas, tokens).