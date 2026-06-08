# Especificação Técnica e Arquitetura Backend (NestJS & PostGIS)

## 1. Visão Geral da Arquitetura
O backend do CarbonEye atua como o cérebro da plataforma e funciona no modelo de **BFF (Backend For Frontend)**. Desenvolvido sob o paradigma de Arquitetura Modular e Injeção de Dependências, ele centraliza cálculos matemáticos complexos, o geoprocessamento espacial territorial e atua como uma barreira de segurança (*Proxy*) entre o aplicativo mobile e os provedores de satélite terceirizados.

## 2. Stack Tecnológico e Infraestrutura
A camada de serviços foi projetada para garantir escalabilidade, tipagem forte e capacidade de realizar cálculos vetoriais em tempo real.

* **Framework Principal:** NestJS.
* **Linguagem:** TypeScript (Strict Mode).
* **Engenharia de Software (POO Avançada):** Implementação de Herança clássica utilizando uma `EntidadeBase` abstrata que propaga IDs e timestamps de criação (`criado_em`) genéricos para todas as tabelas (Usuario, Area, Alerta, HistoricoSiri, SistemaLog). Uso estrito de **Value Objects (VOs)** para isolar regras de negócio independentes, como a classe `CoordenadaVO` que valida latitudes e longitudes.
* **Banco de Dados Relacional:** PostgreSQL.
* **Motor Geoespacial:** Extensão PostGIS ativada no PostgreSQL, fundamental para os cálculos vetoriais.
* **Mapeamento Objeto-Relacional (ORM):** TypeORM para gerenciar conexões, entidades e migrações.

## 3. Estrutura Modular (Domain-Driven Design - DDD)
O NestJS foi estruturado separando os domínios da aplicação, garantindo baixo acoplamento e alta coesão:

* **`AuthModule`:** Gerencia o fluxo de autenticação e geração de JWT.
* **`AreasModule`:** Responsável por receber o *Payload* do mobile e lidar com regras complexas, incluindo salvamento de "Snapshots" em JSONB quando o monitoramento de uma área é desativado (offline-history).
* **`GeoModule`:** Módulo core. Contém os Value Objects (ex: `CoordenadaVO`) e a lógica de comunicação vetorial.
* **`SiriModule`:** O motor de cálculo. Recebe os dados de vegetação e incêndios para aplicar os pesos matemáticos.
* **`IntegrationsModule`:** Módulo isolado contendo integrações específicas de satélite.
* **`AlertasModule`:** Responsável pela injeção e gerência do fluxo de notificações do usuário, controlando estados de leitura e persistência.

## 4. Pipeline de Processamento e Tratamento de Dados
O tráfego de uma requisição segue um fluxo estrito de validação:

1. **Camada de Transporte (Controller):** Recebe a requisição HTTP.
2. **Validação Rigorosa (Pipes/VOs):** O payload é injetado no `CoordenadaVO` que rejeita instantaneamente latitudes fora da métrica (-90 a 90) ou longitudes inválidas antes de prosseguir.
3. **Regra de Negócio (Service):**
   * Dispara processos assíncronos e lógicas de negócio do domínio.
4. **Camada de Acesso a Dados (Repository):** Persiste os relatórios e entidades herdadas da `EntidadeBase` no TypeORM.

## 5. Orquestração de Integrações e Estratégia de Rede
A complexidade do backend do CarbonEye exige o tratamento cuidadoso das APIs externas. Contudo, em nome da performance da arquitetura, promoveu-se uma divisão de responsabilidades com o Front-end:

* **AgroMonitoring API:** O backend aciona o `POST /polygons` de forma segura. Apenas os polígonos validados geomêtricamente ganham acesso a essa requisição para poupar franquia do pacote em nuvem.
* **NASA FIRMS:** Utilizada para detecção ativa de anomalias térmicas num raio de abrangência da área.
* **OpenWeather API (Delegação ao Client-Side):** Originalmente arquitetado no Backend, a chamada climática pesada (60 req/minuto) foi delegada diretamente ao aplicativo Frontend. Isso desonera a CPU do servidor e impede o estrangulamento da chave pública, aproveitando o IP descentralizado de cada usuário final para a consulta climática.

## 6. Monitoramento Contínuo e Alertas (Mock e Cron Jobs)
Para cumprir o requisito de monitoramento ativo:

* **Varredura (Conceitual):** A lógica prevê o processamento iterativo sobre `Areas` cujo `monitoramentoAtivo === true`.
* **Motor de Testes (Mock Alerts):** Para possibilitar a homologação acadêmica na Global Solution, foi criada uma rota injetora de alertas simulados (`/areas/:id/alertas/mock`) que imita disparos críticos do satélite (Incêndio, Queda de NDVI ou Clima Extremo) sem necessidade de aguardar um desastre real ocorrer no país, atualizando a central de notificações nativamente.

## 7. Segurança e Validação
* **Herança Segura:** A propriedade das áreas é garantida pelo relacionamento FK vinculado ao Token (`@GetUser`), blindando consultas cruzadas.
* **Logs e Auditoria:** As ações críticas geram eventos na tabela `SistemaLog` persistida no PostGIS.