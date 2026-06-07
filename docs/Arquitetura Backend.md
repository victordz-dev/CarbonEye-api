# Especificação Técnica e Arquitetura Backend (NestJS & PostGIS)

## 1. Visão Geral da Arquitetura
O backend do CarbonEye atua como o cérebro da plataforma e funciona no modelo de **BFF (Backend For Frontend)**. Desenvolvido sob o paradigma de Arquitetura Modular e Injeção de Dependências, ele centraliza cálculos matemáticos complexos, o geoprocessamento espacial territorial e atua como uma barreira de segurança (*Proxy*) entre o aplicativo mobile e os provedores de satélite terceirizados.

## 2. Stack Tecnológico e Infraestrutura
A camada de serviços foi projetada para garantir escalabilidade, tipagem forte e capacidade de realizar cálculos vetoriais em tempo real.

* **Framework Principal:** NestJS.
* **Linguagem:** TypeScript (Strict Mode).
* **Banco de Dados Relacional:** PostgreSQL.
* **Motor Geoespacial:** Extensão PostGIS ativada no PostgreSQL, fundamental para os cálculos de `ST_Intersects`, áreas e sobreposições de polígonos.
* **Mapeamento Objeto-Relacional (ORM):** TypeORM para gerenciar conexões, entidades e migrações.
* **Infraestrutura e Deploy:** Docker e Docker Compose, garantindo paridade total entre o ambiente de desenvolvimento (local) e a nuvem.

## 3. Estrutura Modular (Domain-Driven Design - DDD)
O NestJS foi estruturado separando os domínios da aplicação, garantindo baixo acoplamento e alta coesão:

* **`AuthModule`:** Gerencia o fluxo de autenticação, geração de JWT e criptografia de senhas (bcrypt).
* **`AreasModule`:** Responsável por receber o *Payload* de coordenadas do mobile, validar o tamanho do polígono e salvar o projeto.
* **`GeoModule`:** Módulo core. Contém a lógica de comunicação direta com a extensão PostGIS para cruzar a geometria recebida com as tabelas `territorios_protegidos` (CNUC/FUNAI).
* **`SiriModule`:** O motor de cálculo. Recebe os dados de vegetação, clima e incêndios e aplica os pesos matemáticos para retornar a nota de 0 a 100.
* **`IntegrationsModule`:** Módulo isolado contendo os *Services* específicos (AgroMonitoring, NASA e OpenWeather).
* **`TasksModule`:** Responsável pelos *Cron Jobs* de monitoramento contínuo em *background*.

## 4. Pipeline de Processamento e Tratamento de Dados
O tráfego de uma requisição segue um fluxo estrito de validação antes de atingir o banco ou consumir cotas de API:

1. **Camada de Transporte (Controller):** Recebe a requisição HTTP.
2. **Validação de DTOs (Pipes):** Utilização do `class-validator` e `class-transformer` para garantir que o *array* de coordenadas recebido forma um polígono geométrico válido e sem auto-intersecções.
3. **Regra de Negócio (Service):**
   * Valida se a área não ultrapassa o limite de 10 hectares (100.000m²) por consulta e se o usuário possui saldo na cota mensal acumulada (40 hectares / 4 consultas).
   * Dispara a query espacial `ST_Intersects` no banco de dados.
4. **Camada de Acesso a Dados (Repository):** Persiste o Laudo e o Histórico no TypeORM utilizando transações (`QueryRunner`) para garantir consistência.

## 5. Orquestração de Integrações e Rate Limiting
A maior complexidade do backend do CarbonEye é proteger as cotas restritas das APIs consumidas. Para isso, foram adotadas estratégias de estrangulamento e filas de requisição:

* **AgroMonitoring API:** O NestJS atua como validador final. A requisição pesada de `POST /polygons` (que consome a cota de hectares) **só é disparada** caso o PostGIS confirme que a área não invade terras protegidas.
* **Incêndios (INPE & NASA FIRMS):** Para a análise de histórico de 12 meses do índice SIRI, o backend realiza buscas espaciais rápidas no banco de dados local (`ST_DWithin` com índice `GIST`), alimentado periodicamente com datasets do **BDQueimadas do INPE**. A API **NASA FIRMS** é consumida sob demanda em tempo real apenas durante as varreduras diárias das áreas monitoradas para detectar focos ativos recentes (últimas 24h a 72h) no raio de 10km e emitir alertas.
* **OpenWeather API (Controle de Rajada):** Para respeitar o limite gratuito (60 chamadas por minuto), o consumo em massa dessa API durante as varreduras dos mapas em monitoramento é estruturado em lotes utilizando `setTimeout` ou controle de filas (ex: *BullMQ*).

## 6. Monitoramento Contínuo e Alertas (Cron Jobs)
Para cumprir o requisito de monitoramento ativo, o backend não depende de interações do usuário. Ele possui processos agendados (`@nestjs/schedule`):

* **Varredura Diária:** Uma vez por dia (de madrugada), o Cron Job itera sobre todas as `Areas` ativas no banco de dados.
* Ele consome a rota do NASA FIRMS buscando novas anomalias térmicas.
* Caso um incêndio seja detectado próximo ao perímetro de uma área, o sistema registra a entidade `Alerta` no banco de dados e dispara um aviso para o usuário (via push ou alimentando a aba de Notificações).
* A nota "SIRI Atual" presente no banco de dados é recalculada para refletir o evento, atualizando o status do Dashboard do usuário para `ALERTA` ou `EMERGÊNCIA`.

## 7. Segurança e Validação
* **Proteção de Rotas:** Todos os *endpoints* (exceto Login e Cadastro) são protegidos pelo `JwtAuthGuard`.
* **Sanitização:** Todos os *inputs* geográficos são higienizados para evitar injeções de SQL espaciais na conversão de GeoJSON para `Geometry` no PostGIS.
* **Gerenciamento de Segredos:** Variáveis de ambiente, senhas do banco e Chaves de API (`API_KEYS`) são gerenciadas estritamente via `.env` utilizando o `@nestjs/config`, garantindo que nenhuma credencial suba para o repositório.