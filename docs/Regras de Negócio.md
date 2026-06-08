# Regras de Negócio

- **RN01 - Unicidade de Cadastro:**
  Não é permitida a existência de contas duplicadas. O E-mail e o CPF de cada usuário devem ser exclusivos no banco de dados.

- **RN02 - Limites Mensais e de Monitoramento:**
  A conta do usuário possui um teto restrito de uso. O usuário pode realizar no máximo 4 consultas por mês, com as áreas somando no máximo 40 hectares (ha) acumulados no período. Adicionalmente, o usuário pode manter até 2 mapas sob monitoramento contínuo simultaneamente, sendo que o monitoramento ativo destas duas áreas salvas não consome a cota mensal de consultas ou hectares do usuário.

- **RN03 - Limite Dimensional de Triagem:**
  O tamanho máximo permitido para o desenho de qualquer polígono de análise é de 100.000m² (ou 10 hectares) por consulta.

- **RN04 - Restrição de Fronteira:**
  O escopo do sistema atende exclusivamente ao território brasileiro. Qualquer tentativa de processar coordenadas localizadas fora dos limites do Brasil deve ser bloqueada.

- **RN05 - Hierarquia de Validação Territorial (Economia de Cota):**
  A verificação de sobreposição espacial é obrigatória e deve ser feita antes de qualquer coisa. Se a área desenhada invadir uma Terra Indígena (TI) ou Unidade de Conservação (UC), a área recebe automaticamente o laudo "Área com Restrição Territorial Identificada". Neste cenário, o sistema está proibido de acionar qualquer API externa (AgroMonitoring).

- **RN06 - Condição de Classificação Positiva:**
  Para que o laudo final de uma área receba o status de "Potencialmente Classificável", ela deve cumprir dois critérios obrigatórios e simultâneos: ser livre de restrições territoriais e obter uma pontuação ambiental superior a 70 pontos no índice SIRI.

- **RN07 - Composição e Pesos do Índice SIRI:**
  A pontuação do SIRI (de 0 a 100 pontos) deve ser calculada estritamente com a seguinte distribuição:
  - **Saúde Atual da Vegetação:** Peso máximo de 45 pontos.
  - **Tendência Histórica da Vegetação:** Peso máximo de 30 pontos.
  - **Histórico de Incêndios (raio de 10km):** Peso máximo de 20 pontos.
  - **Clima Atual:** Peso máximo de 5 pontos.

- **RN08 - Irreversibilidade do Consumo de Cota:**
  O consumo de área trafegado para a API AgroMonitoring é definitivo. A exclusão de uma área do histórico do usuário não estorna a área (em hectares) consumida do limite mensal.

- **RN09 - Exibição Segmentada (Monitoramento x Histórico):**
  A interface principal (Home) apenas exibe as áreas cujo `monitoramento_ativo` é verdadeiro. Áreas não monitoradas caem estritamente para a aba de Histórico, com gráficos renderizados a partir do último estado conhecido salvo no banco de dados (Snapshot).

- **RN10 - Via de Mão Única no Monitoramento:**
  O ato de cessar o monitoramento de uma área é definitivo (via de mão única). Uma vez marcado como "Não Monitorar", a API do AgroMonitoring não é mais consumida e o polígono é salvo de forma imutável via JSONB (Snapshot) na tabela de Áreas para visualização vitalícia offline, não sendo possível retomar a assinatura contínua daquela exata área posteriormente.

- **RN11 - Homologação de Alertas Climáticos (Mocks):**
  Dado que desastres ambientais são imprevisíveis, o sistema provê nativamente um ambiente simulado ("Área de Testes" em Configurações) onde o usuário pode disparar intencionalmente Alertas Falsos de Queimadas ou Eventos Climáticos para comprovar a recepção de push-notifications ou atualizações do feed em tempo real.