# Requisitos Funcionais (RF)

- **RF01 - Autenticação de Usuário:**
O sistema deve permitir que o usuário realize login utilizando e-mail e senha cadastrados.

- **RF02 - Cadastro de Conta:**
O sistema deve permitir o cadastro de usuários mediante preenchimento de nome, CPF, e-mail, senha e confirmação de senha.

- **RF03 - Gerenciamento de Conta:**
O sistema deve permitir que o usuário altere seus dados cadastrais, senha, tema da aplicação e realize logout ou exclusão da conta.

- **RF04 - Validação de Credenciais:**
O sistema deve validar as informações fornecidas pelo usuário durante o cadastro.

- **RF05 - Layout e Navegação:**
O sistema deve possuir abas para navegação entre diferentes funcionalidades: Início, Informações, Mapa, Histórico, Configurações e uma tela para notificações.

- **RF06 - Navegação: Tela Inicial:**
O sistema deve exibir uma tela inicial contendo mapas monitorados, status ambientais, quantidade de análises restantes e limites de monitoramento disponíveis.

- **RF07 - Navegação: Mapa Geral de Monitoramento:**
O sistema deve apresentar uma aba apenas para o mapa panorâmico do território brasileiro contendo marcações das áreas monitoradas pelo usuário.

- **RF08 - Navegação: Informações:**
O sistema deve exibir dashboards contendo informações ambientais e estatísticas das áreas monitoradas.

- **RF09 - Comparação entre Áreas:**
O sistema deve permitir a comparação entre diferentes áreas monitoradas ou entre períodos distintos da mesma área.

- **RF10 - Navegação: Histórico:**
O sistema deve exibir uma tela contendo informações sobre as análises realizadas, ordenadas de forma cronológica, permitindo a busca, filtragem e visualização dos registros. Além de poder entrar em detalhes sobre cada análise, visualizando o laudo completo, mapas e gráficos, podendo ativar o monitoramento ou excluir do histórico.

- **RF11 - Navegação: Configurações da Conta:**
O sistema deve permitir edição de dados pessoais, senha, tema da aplicação e gerenciamento da conta.

- **RF12 - Status de Serviços Externos:**
O sistema deve exibir o status de disponibilidade dos serviços externos utilizados pela plataforma, ex: agromonitoring: ok, além da data de última atualização.

- **RF13 - Tratamento de Erros:**
O sistema deve impedir ações que violem as regras de negócio e informar falhas de processamento ou indisponibilidade de serviços externos.

- **RF14 - Desenho de Polígonos:**
O sistema deve permitir que o usuário faça pesquisas de áreas, desenhando polígonos irregulares diretamente sobre um mapa exclusivo para adicionar novas áreas de análise.

- **RF15 - Ferramentas Geográficas:**
O sistema deve disponibilizar ferramentas para limpeza, desfazimento de pontos e busca por latitude e longitude durante o desenho do polígono.

- **RF16 - Validação Territorial:**
O sistema deve verificar automaticamente se a área desenhada possui sobreposição com Terras Indígenas ou Unidades de Conservação antes de qualquer integração com sistemas externos.

- **RF17 - Processamento Ambiental:**
O sistema deve buscar e processar dados territoriais, climáticos e orbitais em sistemas externos para cálculo do índice SIRI da área analisada.

- **RF18 - Geração de Laudo Ambiental:**
O sistema deve gerar um laudo ambiental contendo pontuação SIRI, imagem via satélite, dados climáticos, incêndios e gráficos históricos.

- **RF19 - Classificação Ambiental:**
O sistema deve classificar a área analisada conforme os resultados territoriais e ambientais obtidos.

- **RF20 - Exportação de Relatórios:**
O sistema deve permitir a exportação dos laudos, mapas e gráficos em formato PDF.

- **RF21 - Monitoramento Contínuo:**
O sistema deve permitir que o usuário ative o monitoramento contínuo de áreas analisadas.

- **RF22 - Notificações Ambientais:**
O sistema deve emitir notificações automáticas relacionadas a incêndios, alterações climáticas e mudanças abruptas no NDVI.

- **RF23 - Histórico de Áreas:**
O sistema deve armazenar permanentemente o histórico das análises realizadas pelo usuário.

- **RF24 - Gestão de Monitoramento**
O sistema deve permitir ao usuário ativar, pausar e remover monitoramentos de áreas cadastradas.

- **RF25 - Central de notificações**
O sistema deve exibir uma central contendo o histórico de notificações ambientais do usuário.

- **RF26 - Gerenciamento de notificações**
O sistema deve permitir que o usuário visualize e exclua notificações do histórico.

# Requisitos Não Funcionais (RNF)

- **RNF01 - Segurança de Credenciais:**
As senhas dos usuários devem ser armazenadas de forma criptografada no banco de dados.

- **RNF02 - Tempo de Resposta:**
As operações comuns de navegação entre telas devem possuir tempo de resposta inferior a 5 segundos em condições normais de uso.

- **RNF03 - Disponibilidade da Plataforma:**
O sistema deve permanecer disponível para acesso durante a maior parte do tempo, exceto em manutenções programadas.

- **RNF04 - Responsividade da Interface:**
A interface do aplicativo deve adaptar-se corretamente a diferentes tamanhos e densidades de telas de smartphones e tablets.

- **RNF05 - Compatibilidade de Sistemas:**
O aplicativo deve ser compatível com os sistemas operacionais móveis Android e iOS.

- **RNF06 - Integridade de Dados:**
O sistema deve garantir a integridade e consistência das informações armazenadas durante operações de cadastro, atualização e exclusão lógica.

- **RNF07 - Persistência de Dados:**
Os dados das análises, monitoramentos e notificações devem permanecer armazenados mesmo após logout do usuário ou reinicialização da aplicação.

- **RNF08 - Escalabilidade:**
A arquitetura do sistema deve permitir expansão futura para suportar aumento no número de usuários, áreas monitoradas e novas funcionalidades e integrações.

- **RNF09 - Usabilidade:**
A plataforma deve possuir interface intuitiva e de fácil aprendizado para usuários sem conhecimento técnico em geoprocessamento.

- **RNF10 - Acessibilidade:**
O sistema deve possuir suporte a tema claro e escuro, garantindo melhor acessibilidade visual aos usuários.

- **RNF11 - Registro de Logs:**
O sistema deve registrar eventos importantes, falhas de processamento e operações críticas para fins de auditoria e depuração.

- **RNF12 - Eficiência de Processamento:**
As validações territoriais devem ocorrer antes das integrações externas para reduzir consumo desnecessário de recursos computacionais e APIs.

- **RNF13 - Confiabilidade das Integrações:**
O sistema deve tratar falhas de comunicação com serviços externos sem comprometer a estabilidade geral da aplicação.

- **RNF14 - Feedback de erros:**
O sistema deve fornecer feedback claro e objetivo ao usuário em caso de erros, falhas de processamento ou indisponibilidade de serviços externos.

- **RNF15 - Privacidade de Dados:**
Os dados pessoais dos usuários devem ser manipulados conforme princípios de privacidade e proteção de dados.

- **RNF16 - Manutenibilidade:**
O sistema deve possuir arquitetura modular que facilite futuras correções, atualizações e inclusão de novas funcionalidades.

- **RNF17 - Atualização de Dados Ambientais:**
As informações de monitoramento contínuo devem ser atualizadas periodicamente conforme disponibilidade dos serviços externos utilizados.

- **RNF18 - Exportação de Documentos:**
Os arquivos PDF gerados pelo sistema devem manter legibilidade adequada em dispositivos móveis e impressão.

- **RNF19 - Consumo de Recursos:**
O sistema deve minimizar chamadas desnecessárias para APIs externas visando otimizar desempenho e consumo de cotas dos serviços utilizados.