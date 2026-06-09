# Diagramas de Fluxo

## 1. Fluxo Principal — Triagem e Salvamento de Área

```mermaid
flowchart TD
    A["Usuário desenha polígono no mapa mobile"] --> B["Mobile valida geometria localmente"]
    B --> C{"Polígono >= 1ha e <= 50ha cota?"}
    C -- Não --> D["Exibe erro de limite"]
    C -- Sim --> E["POST /areas/analisar"]
    
    E --> F["GeoService.isExatamenteNoBrasil"]
    F --> G{"Dentro do Brasil?"}
    G -- Não --> H["Retorna: 400 Fora do Território"]
    G -- Sim --> I["GeoService.calcularAreaM2 via PostGIS"]
    
    I --> J["GeoService.calcularAreaTotalUsuarioM2"]
    J --> K{"Cota global excedida?"}
    K -- Sim --> L["Retorna: 400 Cota Excedida"]
    K -- Não --> M["GeoService.verificarSobreposicao via PostGIS"]
    
    M --> N{"Intercepta TI/UC?"}
    N -- Sim --> O["Retorna: BLOQUEADO + nome reserva"]
    N -- Não --> P["IntegrationsService.criarPoligono AgroMonitoring"]
    
    P --> Q["SiriService.calcularSiri"]
    Q --> R["Promise.all: NDVI + EVI/NDWI + Clima + Solo + Focos"]
    R --> S["Calcula pontuação 0-100"]
    S --> T["Retorna: LIVRE + SIRI + Clima"]
    
    T --> U{"Usuário confirma salvar?"}
    U -- Não --> V["IntegrationsService.deletarPoligono"]
    U -- Sim --> W["POST /areas salvar"]
    
    W --> X["DataSource.transaction"]
    X --> Y["Salva Area + HistoricoSiri"]
    Y --> Z["Retorna: ID + mensagem"]
    
    style O fill:#ef4444,color:#fff
    style H fill:#ef4444,color:#fff
    style L fill:#ef4444,color:#fff
    style D fill:#ef4444,color:#fff
    style Z fill:#22c55e,color:#fff
    style T fill:#3b82f6,color:#fff
```

---

## 2. Fluxo de Monitoramento Contínuo — Cron Jobs

```mermaid
flowchart TD
    subgraph "Varredura SIRI Semanal - Domingo 00:00"
        A1["Busca áreas com monitoramento ativo"] --> B1["Para cada chunk de 3 áreas em paralelo"]
        B1 --> C1["Extrai coordenadas do GeoJSON"]
        C1 --> D1["SiriService.calcularSiri"]
        D1 --> E1["Atualiza status: NORMAL / ALERTA / EMERGENCIA"]
        E1 --> F1["Salva novo HistoricoSiri no banco"]
    end

    subgraph "Monitoramento Clima e Fogo - A cada hora"
        A2["Busca áreas monitoradas + usuario"] --> B2["Para cada chunk de 3 áreas em paralelo"]
        B2 --> C2["NASA FIRMS: Busca focos ativos 24h"]
        C2 --> D2{"Focos detectados?"}
        D2 -- Sim --> E2["Deduplica por coordenada + janela temporal"]
        E2 --> F2["Salva FocoIncendio + Cria Alerta INCENDIO"]
        F2 --> G2["Push Notification via Expo"]
        D2 -- Não --> H2["OpenWeather: Checa clima extremo"]
        H2 --> I2{"Temp > 35°C ou Umidade < 20%?"}
        I2 -- Sim --> J2["Cria Alerta CLIMA + Push Notification"]
        I2 -- Não --> K2["Área OK, sem alertas"]
    end

    subgraph "Garbage Collector - A cada hora"
        A3["Lista polígonos na API AgroMonitoring"] --> B3["Compara com polígonos salvos no banco"]
        B3 --> C3{"Órfão e criado há > 1 hora?"}
        C3 -- Sim --> D3["Deleta polígono da API"]
        C3 -- Não --> E3["Mantém"]
    end

    style G2 fill:#f59e0b,color:#000
    style J2 fill:#f59e0b,color:#000
    style F1 fill:#22c55e,color:#fff
```

---

## 3. Fluxo de Autenticação e Segurança

```mermaid
flowchart LR
    A["Requisição HTTP"] --> B["Helmet - Headers de Segurança"]
    B --> C["ThrottlerGuard - Rate Limiting"]
    C --> D{"Rota protegida?"}
    D -- Não --> E["Controller público: login, register"]
    D -- Sim --> F["JwtAuthGuard + Passport"]
    F --> G{"Token válido?"}
    G -- Não --> H["401 Unauthorized"]
    G -- Sim --> I["@GetUser extrai userId do token"]
    I --> J["ZodValidationPipe valida Body"]
    J --> K{"Payload válido?"}
    K -- Não --> L["422 Validation Error"]
    K -- Sim --> M["Controller -> Service -> Repository"]
    M --> N["AllExceptionsFilter formata resposta"]

    style H fill:#ef4444,color:#fff
    style L fill:#ef4444,color:#fff
```

---

## 4. Fluxo do Cálculo SIRI

```mermaid
flowchart TD
    A["Recebe coordenadas + polyId"] --> B["obterCentroide via geo.utils"]
    B --> C["Promise.all: 5 chamadas paralelas"]
    
    C --> D["AgroMonitoring: Histórico NDVI 12 meses"]
    C --> E["AgroMonitoring: EVI + NDWI recentes"]
    C --> F["PostGIS: Focos no raio de 10km"]
    C --> G["OpenWeather: Clima atual"]
    C --> H["AgroMonitoring: Solo - umidade e temperatura"]
    
    D --> I["Nota Vegetação: max 45pts"]
    E --> I
    D --> J["Nota Histórico: max 30pts"]
    F --> K["Nota Incêndios: max 20pts"]
    G --> L["Nota Clima: max 5pts"]
    H --> L
    
    I --> M["Soma = Vegetação + Histórico + Incêndios + Clima"]
    J --> M
    K --> M
    L --> M
    
    M --> N{"NDVI atual < 0.25?"}
    N -- Sim --> O["Penalidade: teto máximo 35pts"]
    N -- Não --> P["Pontuação final 0-100"]
    O --> P
    
    P --> Q{"0-39: Risco"}
    P --> R{"40-69: Atenção"}
    P --> S{"70-100: Baixo Risco"}
    
    style Q fill:#ef4444,color:#fff
    style R fill:#f59e0b,color:#000
    style S fill:#22c55e,color:#fff
```
