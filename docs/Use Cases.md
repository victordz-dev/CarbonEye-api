# Especificação de Casos de Uso (Use Cases) - CarbonEye

## Atores do Sistema
* **Usuário:** O proprietário rural, desenvolvedor ambiental ou auditor que interage com o aplicativo mobile.
* **Sistema (Backend/Cron):** As rotinas automatizadas que rodam em *background* no servidor NestJS.
* **APIs Externas:** Serviços de terceiros (PostGIS Local, AgroMonitoring, NASA FIRMS, OpenWeather) que processam e fornecem os dados geoespaciais.

---

## UC01 - Realizar Triagem Ambiental de Nova Área (Core)
**Ator Principal:** Usuário  
**Descrição:** O processo central onde o usuário desenha um polígono e o sistema cruza os dados para gerar o Laudo SIRI.  
**Pré-condições:** O usuário deve estar autenticado e possuir saldo na sua cota mensal de consultas e hectares (máximo de 4 consultas e 40 hectares no mês).

**Fluxo Principal (Caminho Feliz):**
1. O usuário acessa a aba de Mapa e inicia uma "Nova Análise".
2. O usuário toca no mapa para desenhar os vértices do terreno (limite de até 50 pontos).
3. O usuário fecha o polígono com um clique duplo no ponto de origem.
4. O aplicativo valida internamente se o polígono possui tamanho igual ou inferior a 10 hectares (100.000m²) e se está dentro do Brasil.
5. O usuário confirma a análise e atribui um nome ao projeto.
6. O aplicativo exibe uma tela de carregamento e envia as coordenadas ao Backend.
7. O Backend (PostGIS) realiza a intersecção (`ST_Intersects`) e não encontra sobreposição com áreas protegidas.
8. O Backend consome a base local do INPE BDQueimadas e a API AgroMonitoring para extrair os dados orbitais históricos, registrando o consumo de hectares na cota mensal irreversível do usuário.
9. O Backend calcula o índice SIRI (incluindo dados climáticos atuais via OpenWeather), grava os dados na base e retorna o JSON estruturado.
10. O aplicativo exibe o laudo completo com o status *"Potencialmente Classificável"*.

**Fluxos de Exceção e Alternativos:**
* *1a. Limite Dimensional Excedido:* No passo 4, se o polígono for maior que 10 hectares, o aplicativo bloqueia o envio e alerta o usuário para redesenhar.
* *2a. Área com Restrição Territorial (A Trava do PostGIS):* No passo 7, se o PostGIS detectar invasão (ex: Terra Indígena ou Unidade de Conservação):
    1. O Backend interrompe o processamento imediatamente (não aciona a API AgroMonitoring para poupar cota).
    2. Retorna ao aplicativo o status *"Área com Restrição Territorial Identificada"* e o nome da reserva atingida.
    3. O fluxo é encerrado na tela de resultados.
* *3a. Cota Mensal Esgotada:* No passo 1, o sistema bloqueia a ação informando que as 4 consultas do mês ou o limite de 40 hectares já foram consumidos.

---

## UC02 - Ativar Monitoramento Contínuo
**Ator Principal:** Usuário  
**Descrição:** O usuário escolhe uma área que já passou pela triagem inicial e a coloca em observação ativa.  
**Pré-condições:** A área não deve possuir restrições territoriais. O usuário não pode ter atingido o limite de 2 mapas monitorados simultaneamente.

**Fluxo Principal:**
1. O usuário acessa o Laudo de uma área recém-pesquisada ou entra na aba "Histórico".
2. O usuário clica no botão "Ativar Monitoramento".
3. O sistema operacional mobile solicita permissão para enviar Notificações Push (apenas na primeira vez).
4. O Backend atualiza o status do banco de dados (`monitoramento_ativo = true`).
5. A área passa a ser exibida como um *Card* ativo na Tela Inicial (Dashboard), exibindo seu status de risco atual (NORMAL, ALERTA ou EMERGÊNCIA).

**Fluxos de Exceção e Alternativos:**
* *1a. Limite de Monitoramento Atingido:* Se o usuário já tiver 2 áreas ativas, o botão exibe um bloqueio visual e um aviso informando que ele deve pausar o monitoramento de outra área antes de prosseguir.

---

## UC03 - Varredura Automática e Emissão de Alertas (Vigia Espacial)
**Ator Principal:** Sistema (Backend Cron Job)  
**Descrição:** Processo autônomo que monitora anomalias nas terras ativas e notifica os usuários.  
**Pré-condições:** O servidor NestJS deve estar em execução e existir áreas com `monitoramento_ativo = true` no banco.

**Fluxo Principal:**
1. O Cron Job do NestJS é acionado na frequência agendada (ex: diariamente).
2. O Sistema resgata do banco de dados todas as áreas sob monitoramento.
3. Para cada área, o Sistema cria um buffer (*Bounding Box* de 10km) e consome a API online da **NASA FIRMS** (para buscar focos ativos recentes nas últimas 24h a 72h) e do **OpenWeather** (condições climáticas de risco).
4. O Sistema identifica um novo foco de calor de alta confiança próximo ao polígono.
5. O Sistema recalcula a pontuação do "SIRI Atual", rebaixando a nota de vegetação/risco.
6. O Sistema atualiza o status do Dashboard da área para `EMERGÊNCIA`.
7. O Sistema grava o registro na tabela `alertas`.
8. O Sistema dispara uma Notificação Push para o dispositivo do usuário (ex: *"Atenção: Foco de calor detectado a 3km da área Fazenda Rio Verde"*).

---

## UC04 - Consultar Histórico e Exportar Laudo (PDF)
**Ator Principal:** Usuário  
**Descrição:** Visualização de evidências armazenadas (gráfico de NDVI e histórico) e geração do documento final.  
**Pré-condições:** O usuário deve possuir pelo menos uma área analisada salva.

**Fluxo Principal:**
1. O usuário acessa a aba "Histórico".
2. O aplicativo carrega a lista de áreas (buscando no `AsyncStorage` local e sincronizando com a API).
3. O usuário seleciona um mapa e entra na "Tela de Detalhes".
4. O aplicativo renderiza o gráfico em linha do Índice NDVI e o histórico de incêndios.
5. O usuário clica em "Exportar para PDF".
6. O aplicativo envia uma requisição para o backend NestJS solicitando o relatório consolidado. O backend gera o PDF em tempo real combinando os gráficos, metadados e imagem orbital salvos e retorna o arquivo.
7. O aplicativo recebe o PDF e abre a janela de compartilhamento nativa do sistema operacional móvel para salvar ou compartilhar o arquivo gerado.

---

## UC05 - Gerenciar Conta e Autenticação
**Ator Principal:** Usuário  
**Descrição:** Cadastro de credenciais, login e inativação de conta no aplicativo.

**Fluxo Principal (Cadastro):**
1. O usuário não autenticado abre o aplicativo e seleciona "Criar Conta".
2. O usuário preenche Nome, E-mail, Senha e digita o CPF.
3. O aplicativo formata automaticamente o CPF e valida as senhas inseridas.
4. Os dados são enviados ao Backend, que criptografa a senha e persiste o usuário.
5. O Backend retorna o Token JWT e o usuário é redirecionado para a Tela Inicial (vazia).

**Fluxo Alternativo (Exclusão Lógica):**
1. O usuário acessa a aba "Configurações" e clica em "Excluir Conta".
2. O aplicativo exibe um modal de confirmação irreversível.
3. O usuário confirma.
4. O Backend aplica o *Soft Delete* no usuário, mantendo os registros passados para auditoria da API, mas inativando o login.
5. O aplicativo limpa o `AsyncStorage` e redireciona para a tela de Login.