# Premissas e Limitações do Sistema (CarbonEye)

## 1. Premissas (Assumptions)
*As condições assumidas como verdadeiras para que o sistema funcione conforme o projetado.*

* **Foco Territorial Restrito:** O sistema assume que todas as análises serão realizadas exclusivamente dentro do território nacional brasileiro. As bases de dados espaciais (Terras Indígenas e Unidades de Conservação) no PostGIS refletem apenas a jurisdição do Brasil.
* **Caráter Preliminar da Análise:** O Índice SIRI (Satellite Environmental Risk Index) é uma métrica algorítmica de triagem rápida. Assume-se que o laudo gerado pela plataforma possui caráter estritamente informativo e direcional, não substituindo auditorias ambientais oficiais, certificações legais ou estudos fundiários detalhados exigidos por órgãos validadores de crédito de carbono.
* **Disponibilidade de Serviços Terceirizados:** O pleno funcionamento do motor de cálculo depende da disponibilidade contínua e da manutenção das estruturas de resposta (contratos JSON/CSV) das APIs da AgroMonitoring, NASA FIRMS e OpenWeather.
* **Conectividade Inicial:** Embora o aplicativo mobile possua arquitetura Offline-First (utilizando AsyncStorage para visualização de históricos e laudos salvos), assume-se que o usuário possua conexão estável com a internet no momento exato do desenho e submissão de uma nova área para processamento.

## 2. Limitações (Limitations)
*As restrições técnicas, financeiras ou lógicas impostas ao sistema.*

* **Teto de Metragem por Polígono:** Para mitigar o esgotamento das cotas de processamento orbital, o sistema impõe um bloqueio rígido no front-end e back-end que impede o desenho e a submissão de polígonos cuja área total ultrapasse 10 hectares (100.000m²) por consulta.
* **Restrições de Cota do Usuário:** Para viabilizar a distribuição justa de recursos, cada conta de usuário está limitada a realizar, no máximo, 4 consultas de novas áreas por mês e consumir no máximo 40 hectares acumulados no período. Adicionalmente, o usuário pode manter até 2 mapas sob o regime de monitoramento contínuo (os quais não consomem da cota de hectares/consultas mensais).
* **Irreversibilidade do Consumo Orbital:** O limite global de 1.000 hectares mensais fornecido pela conta da API AgroMonitoring é absoluto para a aplicação. A exclusão de uma área do histórico do usuário não devolve a área (em hectares) processada ao saldo do limite mensal do usuário.
* **Granularidade e Origem de Incêndios:** Para calcular o índice histórico de incêndios de 12 meses sem lentidão, a aplicação consome uma base local alimentada com dados do BDQueimadas do INPE. A API NASA FIRMS fica restrita à verificação de alertas de focos ativos nas últimas 24h a 72h no entorno de 10km dos mapas monitorados.
* **Gargalo de Infraestrutura (Free Tier):** Devido à hospedagem da API em plano gratuito (Render), o servidor backend entra em estado de hibernação (cold start) após 15 minutos de inatividade. Isso impõe um atraso de até 50 segundos na primeira requisição após períodos ociosos e exige a configuração de pingers externos (ex: UptimeRobot) para garantir que as rotinas de varredura noturna (Cron Jobs) sejam executadas adequadamente.
* **Granularidade Térmica:** O raio geográfico utilizado para a detecção de anomalias térmicas (NASA FIRMS) é fixado estritamente em 10 quilômetros a partir da fronteira do polígono desenhado, não sendo possível ao usuário personalizar essa distância de cobertura.