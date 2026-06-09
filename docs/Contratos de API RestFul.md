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

### 1.3. Atualizar Perfil
Permite alterar nome e/ou senha do usuário autenticado.

* **URL:** `/auth/profile`
* **Método:** `PUT`
* **Body (Request):**
  ```json
  {
    "nome": "Victor D. Rodriguez",
    "senhaAtual": "senha_antiga",
    "novaSenha": "nova_senha_123"
  }
  ```
* **Success Response (200 OK):**
  ```json
  {
    "token": "eyJ...(novo token)...",
    "usuario": { "id": "...", "nome": "Victor D. Rodriguez", "email": "..." }
  }
  ```

### 1.4. Excluir Conta
Aplica soft delete no usuário, inativando o login mas preservando registros para auditoria.

* **URL:** `/auth/profile`
* **Método:** `DELETE`
* **Success Response:** `204 No Content`

### 1.5. Atualizar Push Token
Registra o token do Expo Push Notifications para o dispositivo do usuário.

* **URL:** `/auth/push-token`
* **Método:** `PATCH`
* **Body (Request):**
  ```json
  {
    "token": "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]"
  }
  ```
* **Success Response (200 OK):**
  ```json
  {
    "message": "Push token atualizado com sucesso"
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
    "classificacao_final": "Área com Baixo Risco Ambiental (Potencialmente Classificável)",
    "agro_polygon_id": "603b57f...",
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
    }
  }
  ```
* **Success Response - Cenário Área Bloqueada (200 OK):**
  ```json
  {
    "status_territorial": "BLOQUEADO",
    "classificacao_final": "Área com Restrição Territorial Identificada",
    "motivo": "Sobreposição detectada com a reserva protegida: TI Yanomami (Terra Indígena)."
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
    "agro_polygon_id": "603b57f...",
    "siri_completo": { "pontuacaoTotal": 85, "..." : "..." }
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
* **Success Response (200 OK):** *Array de áreas com alertas aninhados.*

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
    "temp_solo": 25.0,
    "imagem_satelite_truecolor": "https://...",
    "imagem_satelite_ndvi": "https://..."
  }
  ```
  > **Nota:** Os campos `evi_atual`, `ndwi_atual`, `umidade_solo` e `temp_solo` podem ser `undefined` caso a API externa esteja indisponível no momento da consulta.

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
    "mensagem": "Monitoramento pausado e snapshot gerado com sucesso."
  }
  ```

### 2.6. Renomear Área
Altera o nome de uma área existente.

* **URL:** `/areas/:id/nome`
* **Método:** `PATCH`
* **Body (Request):**
  ```json
  {
    "nome": "Fazenda Rio Verde Norte"
  }
  ```
* **Success Response (200 OK):**
  ```json
  {
    "mensagem": "Área renomeada com sucesso."
  }
  ```

### 2.7. Obter Laudo Técnico em PDF
Gera dinamicamente o arquivo PDF com o relatório ambiental da área selecionada e faz download direto.

* **URL:** `/areas/:id/laudo-pdf`
* **Método:** `GET`
* **Success Response (200 OK):**
  * *Retorna arquivo binário com Content-Type `application/pdf`*
  * Headers adicionados:
    * `Content-Type: application/pdf`
    * `Content-Disposition: attachment; filename="laudo-siri-<id>.pdf"`

### 2.8. Excluir Área
Remove a área monitorada do banco de dados (também exclui em cascata seu histórico SIRI e alertas associados).

* **URL:** `/areas/:id`
* **Método:** `DELETE`
* **Success Response (200 OK):**
  ```json
  {
    "mensagem": "Área excluída com sucesso."
  }
  ```

### 2.9. Criar Alerta Mock (Testes)
Injeta um alerta simulado (incêndio, degradação ou clima extremo) para fins de apresentação acadêmica.

* **URL:** `/areas/:id/alertas/mock`
* **Método:** `POST`
* **Success Response (201 Created):**
  ```json
  {
    "mensagem": "Alerta de teste (mock) criado com sucesso."
  }
  ```

---

## 3. Alertas

### 3.1. Listar Alertas do Usuário
Retorna todos os alertas associados às áreas do usuário, ordenados por data de criação descendente.

* **URL:** `/alertas`
* **Método:** `GET`
* **Success Response (200 OK):** *Array de alertas com relação de área aninhada.*

### 3.2. Marcar Alerta como Lido
* **URL:** `/alertas/:id/lida`
* **Método:** `PATCH`
* **Success Response (200 OK):**
  ```json
  {
    "mensagem": "Alerta marcado como lido."
  }
  ```

### 3.3. Excluir Alerta
* **URL:** `/alertas/:id`
* **Método:** `DELETE`
* **Success Response (200 OK):**
  ```json
  {
    "mensagem": "Alerta excluído com sucesso."
  }
  ```

---

## 4. Logs (Frontend)

### 4.1. Enviar Log do Frontend
Registra eventos/erros do aplicativo mobile no banco de dados para auditoria. **Requer autenticação.** Rate limited a 30 requisições por minuto.

* **URL:** `/logs`
* **Método:** `POST`
* **Body (Request):**
  ```json
  {
    "acao": "Erro ao carregar mapa",
    "detalhes": { "tela": "MapScreen", "stack": "..." },
    "nivel": "ERROR"
  }
  ```
* **Success Response (200 OK):**
  ```json
  {
    "success": true
  }
  ```