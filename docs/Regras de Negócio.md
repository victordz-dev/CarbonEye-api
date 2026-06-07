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
  A verificação de sobreposição espacial é obrigatória e deve ser feita antes de qualquer coisa. Se a área desenhada invadir uma Terra Indígena (TI) ou Unidade de Conservação (UC), a área recebe automaticamente o laudo "Área com Restrição Territorial Identificada". Neste cenário, o sistema está proibido de acionar qualquer API externa.

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

- **RN09 - Exclusão Autenticada (Soft Delete):**
  A exclusão do mapa do histórico do usuário é o único meio de remoção do sistema. Essa ação não deleta o registro físico do banco de dados (visando manter o histórico para fins de auditoria), mas o inativa para a visualização do usuário.

- **RN10 - Retomada de Monitoramento:**
  Se o usuário pausar o monitoramento de uma área e posteriormente reativá-lo, o registro de atualizações contínuas de métricas deverá ser reiniciado a partir do momento da nova ativação, não preenchendo as lacunas temporais do período em que esteve pausado.