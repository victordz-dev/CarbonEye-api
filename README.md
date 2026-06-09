# CarbonEye - API (Backend)

Bem-vindo ao repositório backend do **CarbonEye**, uma plataforma de monitoramento ambiental que atua como o motor inteligente (*Backend For Frontend*) para calcular e classificar o risco ecológico de áreas rurais ou ambientais dentro do território brasileiro utilizando o índice **SIRI (Satellite Environmental Risk Index)**.

O backend foi construído visando robustez e velocidade, utilizando as seguintes tecnologias principais:
- **NestJS** e **TypeScript**
- **PostgreSQL** com a extensão espacial **PostGIS**
- Integrações em tempo real com **AgroMonitoring**, **NASA FIRMS** e **OpenWeather**
- Sistema local em memória (`CacheModule`) para alta performance na devolução de dados ambientais históricos
- Tratamento de exceções formatado globalmente, protegendo o vazamento de stack-traces sensíveis

## 📖 Documentação Detalhada

Para consultar a fundo a arquitetura do sistema, diagrama de banco de dados, regras de negócio e os cálculos matemáticos precisos por trás da Inteligência do SIRI, navegue até a **[Seção de Documentação](./docs)** deste repositório, que contém:
- Arquitetura do Backend
- Contratos de API RestFul
- Diagrama MER
- Premissas e Limitações
- Regras de Negócio e Casos de Uso
- Mecânica do SIRI

## 🚀 Acesse a API em Produção

O nosso projeto está **em deploy contínuo** e disponível para ser acessado e testado.

- **Link Base (Render):** `https://carboneye-api.onrender.com`
- **Documentação da API (Swagger):** [https://carboneye-api.onrender.com/api/docs](https://carboneye-api.onrender.com/api/docs)

### 📸 Evidências de Execução
> **Nota ao avaliador:** Além do link ativo acima que permite o teste real da aplicação, você pode conferir o funcionamento da API na prática por meio do nosso Swagger UI e das capturas de tela do aplicativo Mobile consumindo estes mesmos endpoints.

*(Adicione aqui os links para as imagens/prints do Swagger retornando 200 OK ou um link de um vídeo do YouTube demonstrando o uso)*
- [Print do Swagger UI testando a Rota X](#)
- [Print do Banco de Dados PostGIS populado](#)
- [Vídeo de Apresentação (YouTube)](#)

## 👥 Integrantes da Equipe

- **Guilherme Oliveira** – RM: 558797
- **Matheus Dantas** – RM: 558804
- **Rafael Panhoca** – RM: 555014
- **Silas Alves** – RM: 555020
- **Victor Rodriguez** – RM: 559094
