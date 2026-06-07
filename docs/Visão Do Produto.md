# CarbonEye - Visão do Produto
## 1. Visão Geral do Projeto
O CarbonEye é uma plataforma digital de análise e monitoramento ambiental baseada em dados geoespaciais, climáticos e orbitais. Seu propósito é facilitar a avaliação preliminar de áreas naturais por meio da integração de diferentes fontes de informação em uma única solução acessível e intuitiva.

A plataforma permite que o usuário delimite uma área de interesse diretamente sobre um mapa digital utilizando polígonos que representam os limites reais do terreno. A partir dessa delimitação, o sistema realiza análises automáticas que consideram aspectos territoriais, ambientais e históricos, fornecendo informações relevantes para apoiar processos de tomada de decisão.

O CarbonEye foi concebido para atender diferentes iniciativas relacionadas à gestão ambiental, como projetos de conservação, reflorestamento, recuperação de áreas degradadas, monitoramento de propriedades rurais, estudos ambientais e iniciativas relacionadas ao mercado de carbono.

Além da análise inicial, a plataforma oferece monitoramento contínuo das áreas cadastradas, permitindo acompanhar alterações ambientais ao longo do tempo e identificar riscos de forma antecipada.

## 2. Problemática
A obtenção de informações ambientais confiáveis normalmente exige a consulta de diversas fontes de dados, ferramentas especializadas e profissionais com conhecimento técnico em geoprocessamento, sensoriamento remoto e análise ambiental.

Embora existam grandes quantidades de dados públicos disponibilizados por órgãos governamentais e instituições científicas, essas informações frequentemente encontram-se distribuídas em plataformas distintas, dificultando sua utilização por usuários que não possuem formação específica na área.

Entre os principais desafios observados estão:

- Dificuldade de acesso e interpretação de dados ambientais;
- Necessidade de consultar múltiplas fontes para realizar uma única análise;
- Falta de ferramentas acessíveis para avaliação preliminar de áreas;
- Baixa integração entre dados territoriais, climáticos e orbitais;
- Dificuldade de monitorar mudanças ambientais ao longo do tempo;
- Ausência de mecanismos simplificados para identificação precoce de riscos ambientais.

Essas limitações tornam o processo de análise ambiental mais lento, complexo e dependente de especialistas.

# 3. Objetivo do Produto
O CarbonEye tem como objetivo fornecer uma ferramenta acessível para análise preliminar e monitoramento contínuo de áreas ambientais, utilizando informações geoespaciais e dados de sensoriamento remoto para apoiar a tomada de decisão.

Diferentemente de plataformas técnicas tradicionais, o CarbonEye prioriza acessibilidade e simplificação da análise ambiental preliminar, reduzindo a necessidade de múltiplas ferramentas especializadas.
A plataforma busca reduzir a complexidade associada à obtenção e interpretação de dados ambientais, permitindo que usuários sem conhecimento avançado em geotecnologias tenham acesso a informações relevantes sobre a situação atual e a evolução histórica de uma determinada área.


A solução não substitui análises técnicas especializadas, mas atua como uma ferramenta de apoio que auxilia na identificação de oportunidades, riscos e potenciais restrições ambientais.

# 4. Proposta de Valor
O principal diferencial do CarbonEye está na consolidação de diferentes fontes de dados ambientais em uma única experiência de uso.

A plataforma integra informações relacionadas a:

- Uso e ocupação territorial;
- Áreas protegidas;
- Saúde da vegetação;
- Evolução histórica da cobertura vegetal;
- Condições climáticas;
- Ocorrência de incêndios florestais;
- Monitoramento contínuo de riscos ambientais.

A partir dessa integração, o sistema gera análises simplificadas e indicadores que auxiliam usuários na avaliação preliminar de áreas naturais, reduzindo o esforço necessário para reunir e interpretar informações dispersas.

# 5. Público-Alvo
### **5.1 Gestores e Desenvolvedores de Projetos Ambientais**

Profissionais, empresas e organizações que atuam em iniciativas de conservação, restauração ecológica, reflorestamento, sustentabilidade e gestão territorial.

Esses usuários necessitam de ferramentas que auxiliem na avaliação inicial de áreas e no acompanhamento de riscos ambientais ao longo do ciclo de vida dos projetos.

### **5.2. Proprietários Rurais**

Produtores rurais e proprietários de áreas com cobertura vegetal que desejam compreender melhor as características ambientais de suas propriedades.

Esses usuários buscam informações que possam apoiar decisões relacionadas à preservação, recuperação ambiental e desenvolvimento sustentável da área.

### **5.3. Consultores e Especialistas Ambientais**

Profissionais responsáveis pela realização de estudos, diagnósticos e avaliações ambientais.

Esses usuários podem utilizar a plataforma como ferramenta complementar para obtenção rápida de indicadores e informações geoespaciais durante análises preliminares ou atividades de campo.

### **5.4. Instituições e Organizações de Conservação**

Organizações não governamentais, associações e entidades envolvidas em projetos de preservação ambiental e monitoramento de ecossistemas.

Essas instituições podem utilizar o sistema para acompanhamento de áreas de interesse e identificação de alterações ambientais relevantes.

# 6. Solução Proposta
A plataforma CarbonEye utiliza tecnologias espaciais para consolidar informações provenientes de satélites, bases territoriais e serviços meteorológicos em uma única aplicação.
O usuário inicia a análise desenhando um polígono diretamente sobre o mapa digital, representando os limites reais da área de interesse.

Após a definição do perímetro, o sistema realiza uma série de verificações automáticas que combinam informações territoriais e ambientais.
Inicialmente, ocorre a validação territorial da área, identificando possíveis sobreposições com bases geográficas oficiais de áreas protegidas, como Terras Indígenas e Unidades de Conservação.
Em seguida, o sistema realiza uma avaliação ambiental baseada em dados de satélite, registros históricos e informações climáticas, produzindo indicadores que representam o estado atual e o comportamento histórico da área analisada.

Essas informações são consolidadas por meio do **SIRI** (Satellite Environmental Risk Index), índice desenvolvido pela própria plataforma para representar o nível de risco ambiental associado à área monitorada.

Além da triagem inicial, a plataforma mantém as áreas cadastradas sob
monitoramento contínuo, permitindo acompanhar alterações ambientais
relevantes ao longo do tempo.

# 7. Índice SIRI

O **SIRI** (Satellite Environmental Risk Index) é um indicador ambiental composto que sintetiza diferentes fatores relevantes para a análise e monitoramento de áreas naturais.
Seu objetivo é transformar múltiplos indicadores ambientais em uma pontuação simplificada e de fácil interpretação para o usuário.

O índice considera aspectos como:
- Saúde atual da vegetação;
- Tendência histórica da vegetação;
- Histórico de incêndios na região;
- Condições climáticas atuais.

A partir desses componentes, o sistema produz uma pontuação que auxilia na avaliação geral da área e serve como base para os processos de monitoramento contínuo.

Os critérios detalhados de cálculo, pesos e metodologias do SIRI são descritos em documentação específica.

# 8. Classificação da Área
Após a conclusão das análises territoriais e ambientais, o CarbonEye gera uma classificação geral da área com o objetivo de facilitar a interpretação dos resultados pelo usuário.

Essa classificação não determina a viabilidade de projetos específicos, mas representa uma visão consolidada das condições ambientais observadas no momento da análise.

A classificação considera:

- Resultado da verificação territorial;
- Pontuação obtida no SIRI (Satellite Environmental Risk Index);


Com base nesses fatores, a área pode ser enquadrada em uma das seguintes categorias:

### **8.1 Área com Baixo Risco Ambiental**

Áreas que apresentam indicadores ambientais predominantemente positivos, vegetação saudável, baixa incidência de eventos críticos e ausência de restrições territoriais identificadas nas bases consultadas.

Essas áreas demonstram maior estabilidade ambiental e menor exposição a fatores de risco monitorados pela plataforma.

### **8.2 Área em Atenção**

Áreas que apresentam sinais moderados de degradação ambiental, oscilações relevantes nos indicadores históricos ou ocorrência eventual de eventos que merecem acompanhamento mais frequente.

Nesses casos, recomenda-se monitoramento contínuo para avaliação da evolução das condições ambientais ao longo do tempo.

### **8.3 Área Sob Risco Ambiental**

Áreas que apresentam indicadores ambientais críticos, degradação significativa da cobertura vegetal, recorrência de incêndios ou outros fatores capazes de comprometer sua estabilidade ambiental.

Essas áreas demandam maior atenção e acompanhamento devido à presença de condições que podem impactar negativamente sua conservação ou recuperação.

### **8.4 Área com Restrição Territorial Identificada**

Áreas que apresentam sobreposição parcial ou total com Terras Indígenas, Unidades de Conservação ou outras bases territoriais incorporadas ao sistema.

Nesses casos, o sistema bloqueia imediatamente o acionamento de APIs externas (economizando cotas de processamento) e a área recebe essa classificação automaticamente, sem a necessidade de cálculo do índice SIRI.

# 9. Monitoramento Contínuo
Após a conclusão da análise inicial, o usuário pode salvar a área para acompanhamento contínuo.

As áreas monitoradas passam por atualizações periódicas dos indicadores ambientais, permitindo acompanhar alterações nas condições observadas ao longo do tempo.

Sempre que forem identificados eventos potencialmente relevantes, como focos de incêndio próximos à área monitorada, degradação da vegetação ou condições climáticas adversas, o sistema poderá gerar alertas para o usuário.

Essa funcionalidade transforma o CarbonEye não apenas em uma ferramenta de análise, mas também em uma plataforma de acompanhamento ambiental contínuo.

# 10. Como o Sistema Funciona
O CarbonEye permite que o usuário realize análises ambientais preliminares de forma simples e rápida. O fluxo básico de uso é o seguinte:

1. **Autenticação:** O usuário acessa a plataforma e faz login com sua conta. Se não possuir uma, pode realizar o cadastro fornecendo suas informações pessoais.

2. **Desenho da Área:** Na tela do mapa, o usuário desenha um polígono irregular para delimitar a área de interesse, representando os limites reais da região a ser analisada.

3. **Validação Territorial:** O sistema verifica automaticamente se a área desenhada apresenta sobreposição com Terras Indígenas, Unidades de Conservação ou outras áreas protegidas identificadas nas bases geográficas consultadas.

4. **Cálculo do SIRI:** Se a área não apresentar conflitos territoriais, o sistema calcula o **SIRI (Satellite Environmental Risk Index)**, combinando informações sobre a saúde da vegetação, histórico de cobertura vegetal, ocorrência de incêndios e dados climáticos da região.

5. **Classificação da Área:** Com base nos resultados da validação territorial e no valor do SIRI, o sistema atribui uma classificação à área, que pode ser: 
    - **Área com Baixo Risco Ambiental**
    - **Área em Atenção**
    - **Área Sob Risco Ambiental**
    - **Área com Restrição Territorial Identificada**

6. **Visualização de Resultados:** O usuário visualiza os resultados em um dashboard com informações detalhadas, incluindo mapas, gráficos e indicadores que representam o estado atual e histórico da área.

7. **Monitoramento Contínuo:** O usuário pode salvar a área para acompanhamento contínuo. A partir daí, o sistema monitora periodicamente a área, gerando alertas automáticos em caso de mudanças ambientais relevantes, como novos focos de incêndio, degradação da vegetação ou condições climáticas extremas.

8. **Exportação e Histórico:** O usuário pode exportar os relatórios, laudos e gráficos para PDF, além de gerenciar o histórico das análises realizadas, podendo excluir registros quando desejar.


# 11. Benefícios Esperados

Com a utilização do CarbonEye, espera-se:

- Facilitar o acesso a informações ambientais relevantes;
- Reduzir o tempo necessário para análises preliminares;
- Integrar diferentes fontes de dados em uma única plataforma;
- Apoiar processos de tomada de decisão baseados em evidências;
- Melhorar a capacidade de monitoramento ambiental de áreas naturais;
- Auxiliar na identificação precoce de riscos ambientais;
- Promover o uso de tecnologias espaciais em desafios ambientais reais.

# 12. Limitações e Premissas
O CarbonEye é uma ferramenta de apoio à decisão e não substitui auditorias, laudos técnicos, estudos ambientais ou pareceres especializados.

Os resultados apresentados dependem da disponibilidade, atualização e qualidade dos dados fornecidos por órgãos governamentais, instituições científicas e serviços externos utilizados pela plataforma.

As classificações e indicadores gerados devem ser interpretados como instrumentos auxiliares de análise preliminar e monitoramento, servindo como apoio para avaliações mais aprofundadas quando necessário.