# SIRI – Satellite Environmental Risk Index
## 1. Visão geral
O Satellite Environmental Risk Index (SIRI) é um indicador desenvolvido pela nossa equipe para avaliar a qualidade ambiental de uma área geográfica delimitada pelo usuário.
O índice foi criado para transformar grandes volumes de dados ambientais provenientes de satélites e serviços meteorológicos em uma pontuação única, simples e compreensível, capaz de apoiar análises preliminares de viabilidade ambiental, monitoramento territorial e processos de tomada de decisão.
A principal proposta do SIRI é reduzir a complexidade da interpretação de múltiplos indicadores ambientais, fornecendo uma avaliação consolidada do estado atual e do histórico recente da área analisada.
A pontuação do índice varia de 0 a 100 pontos, onde valores mais altos representam melhores condições ambientais e menores riscos de degradação.

---

## 2. Objetivos do Índice
O SIRI foi desenvolvido para responder três perguntas fundamentais:

- A vegetação da área está saudável?
  - Avalia a qualidade atual da cobertura vegetal utilizando índices de vegetação derivados de imagens de satélite.

- A vegetação está melhorando ou piorando?
  - Avalia a evolução histórica da vegetação ao longo do tempo para identificar tendências de recuperação, estabilidade ou degradação.
- Existem fatores de risco ambiental relevantes?
  - Analisa a recorrência de incêndios e condições climáticas capazes de comprometer a estabilidade ambiental da região.

---

## 3. Estrutura do Índice
O índice é composto por quatro fatores ambientais.

| FATOR                      | PESO MÁXIMO |
| -------------------------- | ----------- |
| Saúde atual da Vegetação   | 45          |
| Tendência Histórica da Vegetação | 30          |
| Histórico de Incêndios     | 20          |
| Fatores Climáticos         | 5          |
| **TOTAL**                  | **100**     |

A distribuição prioriza a vegetação atual e sua evolução histórica, pois esses fatores representam os indicadores mais relevantes para a análise ambiental da área.

---

## 4. Metodologia de Pontuação
### 4.1 Saúde Atual da Vegetação (45 pontos)
Este componente utiliza o NDVI atual da área monitorada.

| NDVI ATUAL | PONTUAÇÃO |
| ---------- | --------- |
| Maior ou igual a 0.80 | 45 |
| 0.70 - 0.79 | 40 |
| 0.60 - 0.69 | 35 |
| 0.50 - 0.59 | 25 |
| 0.40 - 0.49 | 15 |
| Menor que 0.40 | 0 |
**justificativa:** Áreas com NDVI elevado apresentam maior densidade vegetal, maior vigor biológico e melhores condições ambientais.

### 4.2 Tendência Histórica da Vegetação (30 pontos)
Este componente avalia a variação percentual do NDVI ao longo de um período oficial de 12 meses.
Para evitar distorções sazonais (como comparar a seca com o período de chuvas), a variação é calculada comparando a média de NDVI do trimestre mais recente com a média de NDVI do mesmo trimestre do ano anterior.

|VARIAÇÃO HISTÓRICA|PONTUAÇÃO|
|---------------------------|--------|
| Crescimento superior a 10%  | 30 |
| Crescimento entre 5% e 10%  | 25 |
| Estabilidade (-5% a +5%)    | 20 |
| Queda entre 5% e 10%        | 10 |
| Queda superior a 10%        | 0  |
**justificativa:** O histórico permite identificar áreas que aparentam estar saudáveis atualmente, mas que apresentam degradação ao longo dos meses.

### 4.3 Histórico de Incêndios (20 pontos)
Este componente considera a quantidade de focos de incêndio detectados na área monitorada e em um raio de influência de até 10 quilômetros durante o período oficial de 12 meses.

*Nota de Origem dos Dados:* Para a composição do índice histórico (últimos 12 meses), a base de dados integrada ao servidor é alimentada pelos dados históricos de focos de calor do **BDQueimadas do INPE (Instituto Nacional de Pesquisas Espaciais)**. A API **NASA FIRMS** é utilizada estritamente para o monitoramento em tempo real (Near Real-Time) e envio de alertas diários de incêndios ativos nas áreas sob monitoramento contínuo.

|OCORRÊNCIAS HISTÓRICAS|PONTUAÇÃO|
|------------------------|---------|
|Nenhuma ocorrência       | 20 |
|1 a 3 ocorrências        | 15 |
|4 a 10 ocorrências       | 10 |
|11 a 20 ocorrências      | 5  |
|Acima de 20 ocorrências  | 0  |
**justificativa:** A recorrência de incêndios é um importante indicador de risco ambiental e instabilidade ecológica.

### 4.4 Fatores Climáticos (5 pontos)
Este componente considera condições climáticas atuais associadas ao risco ambiental, avaliadas por parâmetros objetivos da região.

|SITUAÇÃO CLIMÁTICA|PONTUAÇÃO|CRITÉRIOS DE AVALIAÇÃO|
|-----------------|--------|----------------------|
|**Baixo Risco**|5|Umidade Relativa (UR) > 40% **E** Temperatura < 30°C **E** Vento < 15 km/h|
|**Médio Risco**|3|UR entre 20% e 40% **OU** Temperatura entre 30°C e 35°C **OU** Vento entre 15 e 30 km/h|
|**Alto Risco**|0|UR < 20% **OU** Temperatura > 35°C **OU** Vento > 30 km/h|

A classificação considera a combinação de umidade relativa do ar, temperatura atual e velocidade dos ventos para determinar a propensão local a focos e propagação de incêndios.

**justificativa:** Por representar uma condição momentânea, o clima possui menor influência na composição do índice.

---

# 5. Fórmula de Cálculo
A pontuação final do SIRI é obtida pela soma dos quatro componentes:

$$
SIRI = (\text{Saúde da Vegetação}) + (\text{Tendência Histórica}) + (\text{Histórico de Incêndios}) + (\text{Clima})
$$

O resultado será sempre um valor entre 0 e 100 pontos.

---

# 6. Classificação Ambiental
Após o cálculo da pontuação, a área é enquadrada em uma das seguintes categorias:

|PONTUAÇÃO FINAL|CLASSIFICAÇÃO|
|---------------|------------|
|70 a 100|Área com Baixo Risco Ambiental (Potencialmente Classificável)|
|40 a 69|Área em Atenção|
|0 a 39|Área Sob Risco Ambiental|

---

# 7. Utilização na Plataforma
O SIRI não possui caráter legal, regulatório ou certificador.

Seu objetivo é atuar como um mecanismo de triagem preliminar e monitoramento contínuo do próprio sistema, auxiliando usuários na identificação de áreas ambientalmente promissoras ou potencialmente problemáticas.

A classificação final emitida pela plataforma considera simultaneamente:
- O resultado da análise territorial;
- A pontuação do índice SIRI.

Somente áreas sem restrições territoriais identificadas e com pontuação ambiental satisfatória poderão ser classificadas como "Área com Baixo Risco Ambiental (Potencialmente Classificável)".

---

# 8. Monitoramento Contínuo
As áreas cadastradas permanecem sob monitoramento contínuo.

O sistema recalcula periodicamente o índice SIRI utilizando novos dados orbitais e climáticos, permitindo identificar alterações ambientais relevantes ao longo do tempo.

Caso ocorram eventos críticos, como degradação acelerada da vegetação ou novos focos de incêndio próximos à área monitorada, o sistema poderá emitir alertas automáticos ao usuário.

# 9. Limitações

Apesar de utilizar dados ambientais e geoespaciais relevantes para análises preliminares, o SIRI possui limitações inerentes às fontes de dados, aos métodos utilizados e ao próprio escopo da plataforma.

As principais limitações incluem:

- O índice depende diretamente da disponibilidade, atualização e qualidade das informações fornecidas por serviços externos de imagens orbitais, dados climáticos e registros ambientais.

- A cobertura de nuvens, interferências atmosféricas e limitações temporais das imagens de satélite podem impactar a precisão dos indicadores de vegetação utilizados no cálculo.

- O comportamento natural de diferentes biomas brasileiros pode influenciar os valores de NDVI e demais métricas ambientais, não sendo possível interpretar todas as regiões utilizando exatamente os mesmos padrões ecológicos.

- As condições climáticas representam fatores dinâmicos e altamente variáveis, podendo sofrer alterações rápidas após o momento da análise.

- O histórico de incêndios considera exclusivamente os registros disponibilizados pelas bases integradas à plataforma, podendo existir eventos não detectados ou não reportados pelos serviços utilizados.

- O índice possui finalidade exclusivamente informativa e de triagem preliminar, não substituindo auditorias ambientais, laudos técnicos, perícias, estudos de impacto ambiental ou processos oficiais de certificação.

- A pontuação do SIRI não representa garantia de preservação ambiental futura, viabilidade econômica, regularidade fundiária ou elegibilidade para programas ambientais e iniciativas do mercado de carbono.

- As classificações ambientais geradas refletem apenas o estado estimado da área no período analisado, podendo sofrer alterações ao longo do tempo conforme novas atualizações ambientais forem processadas.

- O modelo atual do SIRI foi desenvolvido para fins acadêmicos e experimentais, podendo sofrer ajustes futuros em seus pesos, critérios metodológicos e parâmetros de classificação.