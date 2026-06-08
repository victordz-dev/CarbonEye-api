# Contratos de API (RESTful) - CarbonEye

Este documento define as especificações de comunicação entre a aplicação Mobile e a camada de serviços (Backend). 

## Cabeçalhos Padrão (Headers)
Todas as requisições (exceto `/auth/login` e `/auth/register`) exigem os seguintes cabeçalhos de autenticação e autorização:
* `Authorization: Bearer <JWT_TOKEN>`
* `Content-Type: application/json`

---

## 1. Autenticação e Usuário

### 1.1. Cadastrar Usuário
Cria uma nova conta no sistema. O CPF e o E-mail devem ser únicos.

* **URL:** `/auth/register`
* **Método:** `POST`
* **Body (Request):**
  ```json
  {
    "nome": "Victor Rodriguez",
    "cpf": "12345678900",
    "email": "victor@email.com",
    "senha": "senha_segura_123"
  }
  ```
* **Success Response (201 Created):**
  ```json
  {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6...",
    "usuario": {
      "id": "a1b2c3d4-e5f6-7a8b-9c0d-e1f2a3b4c5d6",
      "nome": "Victor Rodriguez",
      "email": "victor@email.com",
      "cpf": "12345678900"
    }
  }
  ```

### 1.2. Login
Autentica o usuário e devolve o token de sessão junto com os dados cadastrais básicos.

* **URL:** `/auth/login`
* **Método:** `POST`
* **Body (Request):**
  ```json
  {
    "email": "victor@email.com",
    "senha": "senha_segura_123"
  }
  ```
* **Success Response (200 OK):**
  ```json
  {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6...",
    "usuario": {
      "id": "a1b2c3d4-e5f6-7a8b-9c0d-e1f2a3b4c5d6",
      "nome": "Victor Rodriguez",
      "email": "victor@email.com",
      "cpf": "12345678900"
    }
  }
  ```
* **Error Response (401 Unauthorized):**
  ```json
  {
    "message": "Credenciais inválidas.",
    "error": "Unauthorized",
    "statusCode": 401
  }
  ```

---

## 2. Áreas e Geoprocessamento

### 2.1. Analisar Área (Triagem Inicial)
Processa um polígono temporário. Realiza a checagem de sobreposição em PostGIS e, se livre de impedimentos ecológicos, consome as APIs de sensoriamento remoto e climáticas para simular o índice SIRI. Não consome cota de mapas monitorados do usuário.

* **URL:** `/areas/analisar`
* **Método:** `POST`
* **Body (Request):**
  ```json
  {
    "poligono": [
      { "latitude": -23.5505, "longitude": -46.6333 },
      { "latitude": -23.5510, "longitude": -46.6338 },
      { "latitude": -23.5508, "longitude": -46.6345 }
    ]
  }
  ```
* **Success Response - Cenário Área Livre (200 OK):**
  ```json
  {
    "status_territorial": "LIVRE",
    "classificacao_final": "Potencialmente Classificável",
    "siri": {
      "pontuacao_total": 85,
      "detalhes": {
        "vegetacao": 40,
        "historico": 25,
        "incendios": 15,
        "clima": 5
      }
    },
    "area_m2": 2450.5,
    "clima_atual": {
      "temp": 28,
      "umidade": 45
    },
    "imagem_satelite_url": "https://agromonitoring.com/image/12345"
  }
  ```
* **Success Response - Cenário Área Bloqueada (200 OK):**
  ```json
  {
    "status_territorial": "BLOQUEADO",
    "classificacao_final": "Área com Restrição Territorial Identificada",
    "motivo": "Sobreposição detectada com TI Yanomami"
  }
  ```

### 2.2. Salvar Área (Iniciar Monitoramento)
Salva a área analisada sob monitoramento ativo. Apenas áreas com `status_territorial` livre podem ser salvas.

* **URL:** `/areas`
* **Método:** `POST`
* **Body (Request):**
  ```json
  {
    "nome": "Fazenda Rio Verde",
    "poligono": [
      { "latitude": -23.5505, "longitude": -46.6333 },
      { "latitude": -23.5510, "longitude": -46.6338 },
      { "latitude": -23.5508, "longitude": -46.6345 }
    ],
    "monitoramento_ativo": true,
    "siri_inicial": 85
  }
  ```
* **Success Response (201 Created):**
  ```json
  {
    "id": "f8e9d0c1-1234-5678-abcd-ef0123456789",
    "mensagem": "Área salva com sucesso. 1 de 2 mapas em monitoramento."
  }
  ```

### 2.3. Listar Áreas do Usuário (Dashboard)
Retorna todas as áreas salvas pelo usuário autenticado, contendo seus índices climáticos atuais e histórico de alertas integrados.

* **URL:** `/areas`
* **Método:** `GET`
* **Success Response (200 OK):**
  ```json
  [
    {
      "id": "f8e9d0c1-1234-5678-abcd-ef0123456789",
      "usuarioId": "a1b2c3d4-e5f6-7a8b-9c0d-e1f2a3b4c5d6",
      "nome": "Fazenda Rio Verde",
      "geometria": {
        "type": "Polygon",
        "coordinates": [
          [
            [-46.6333, -23.5505],
            [-46.6338, -23.5510],
            [-46.6345, -23.5508],
            [-46.6333, -23.5505]
          ]
        ]
      },
      "status": "NORMAL",
      "siriAtual": 85,
      "classificacaoAtual": "Área com Baixo Risco Ambiental (Potencialmente Classificável)",
      "ultimaAnalise": "2026-06-05T10:00:00.000Z",
      "monitoramentoAtivo": true,
      "agroPolygonId": "603b57f...",
      "criadoEm": "2026-06-05T09:30:00.000Z",
      "alertas": [
        {
          "id": "n1m2k3j4-5678-abcd-ef01-23456789abcd",
          "areaId": "f8e9d0c1-1234-5678-abcd-ef0123456789",
          "tipo": "INCENDIO",
          "mensagem": "Foco de incêndio detectado a 3.2km da sua área.",
          "lida": false,
          "dataEvento": "2026-06-05T14:30:00.000Z"
        }
      ]
    }
  ]
  ```

### 2.4. Obter Histórico de Índices (Gráficos)
Retorna os dados cronológicos do índice NDVI histórico e a contagem de ocorrências de incêndio na área para compor gráficos do aplicativo.

* **URL:** `/areas/:id/historico`
* **Método:** `GET`
* **Success Response (200 OK):**
  ```json
  {
    "linha_do_tempo_ndvi": [
      { "data": "2025-11-01", "valor": 0.82 },
      { "data": "2025-12-01", "valor": 0.80 },
      { "data": "2026-01-01", "valor": 0.85 }
    ],
    "ocorrencias_incendio": 1,
    "evi_atual": 0.81,
    "ndwi_atual": 0.15,
    "umidade_solo": 0.45,
    "temp_solo": 298.15,
    "imagem_satelite_truecolor": "https://agromonitoring.com/image/12345/truecolor",
    "imagem_satelite_ndvi": "https://agromonitoring.com/image/12345/ndvi"
  }
  ```

### 2.5. Alternar Monitoramento
Permite desativar ou reativar o monitoramento periódico da área.

* **URL:** `/areas/:id/monitoramento`
* **Método:** `PATCH`
* **Body (Request):**
  ```json
  {
    "monitoramento_ativo": false
  }
  ```
* **Success Response (200 OK):**
  ```json
  {
    "mensagem": "Monitoramento atualizado com sucesso."
  }
  ```

### 2.6. Obter Laudo Técnico em PDF
Gera dinamicamente o arquivo PDF com o relatório ambiental da área selecionada e faz download direto.

* **URL:** `/areas/:id/laudo-pdf`
* **Método:** `GET`
* **Success Response (200 OK):**
  * *Retorna arquivo binário com Content-Type `application/pdf`*
  * Headers adicionados:
    * `Content-Type: application/pdf`
    * `Content-Disposition: attachment; filename="laudo-siri-<id>.pdf"`

### 2.7. Excluir Área
Remove a área monitorada do banco de dados (também exclui em cascata seu histórico SIRI e alertas associados).

* **URL:** `/areas/:id`
* **Método:** `DELETE`
* **Success Response (200 OK):**
  ```json
  {
    "mensagem": "Área excluída com sucesso."
  }
  ```