# Regras de Negócio

- **RN01 - Unicidade de Cadastro:**
  Não é permitida a existência de contas duplicadas. O E-mail e o CPF de cada usuário devem ser exclusivos no banco de dados.

- **RN02 - Limites e Cotas de Monitoramento:**
  A conta do usuário possui uma cota de área restrita. O usuário pode salvar áreas até atingir o teto global de 50 hectares (ha) na conta. Adicionalmente, o usuário pode manter até 2 mapas sob monitoramento contínuo simultaneamente.

- **RN03 - Limite Dimensional Mínimo:**
  O tamanho mínimo permitido para o desenho de qualquer polígono de análise é de 1 hectare (10.000m²), a fim de garantir a compatibilidade com a resolução do satélite (AgroMonitoring). Não há limite máximo por triagem imposto, desde que não exceda a cota total de 50ha da conta.

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

- **RN08 - Retorno de Cota na Exclusão:**
  A cota de hectares consumida pela área é devolvida automaticamente quando a área é excluída pelo usuário. Isso permite reutilizar o espaço de cota para novas análises.

- **RN09 - Exibição Segmentada (Monitoramento x Histórico):**
  A interface principal (Home) apenas exibe as áreas cujo `monitoramento_ativo` é verdadeiro. Áreas não monitoradas caem estritamente para a aba de Histórico, com gráficos renderizados a partir do último estado conhecido salvo no banco de dados (Snapshot).

- **RN10 - Via de Mão Única no Monitoramento:**
  O ato de cessar o monitoramento de uma área é definitivo (via de mão única). Uma vez desativado, o polígono é excluído da API AgroMonitoring e um snapshot estático é salvo em JSONB na tabela de Áreas para visualização vitalícia offline. Não é possível retomar o monitoramento daquela área — o usuário deve cadastrar um novo polígono.

- **RN11 - Homologação de Alertas Climáticos (Mocks):**
  Dado que desastres ambientais são imprevisíveis, o sistema provê nativamente um ambiente simulado ("Área de Testes" em Configurações) onde o usuário pode disparar intencionalmente Alertas Falsos de Queimadas ou Eventos Climáticos para comprovar a recepção de push-notifications ou atualizações do feed em tempo real.