erDiagram
    USUARIOS {
        UUID id PK
        VARCHAR nome
        VARCHAR cpf UK
        VARCHAR email UK
        VARCHAR senha
        TIMESTAMP criado_em
    }
    
    AREAS {
        UUID id PK
        UUID usuario_id FK
        VARCHAR nome
        GEOMETRY geometria
        ENUM status
        INT siri_atual
        VARCHAR classificacao_atual
        TIMESTAMP ultima_analise
        BOOLEAN monitoramento_ativo
        TIMESTAMP criado_em
    }
    
    HISTORICOS_SIRI {
        UUID id PK
        UUID area_id FK
        INT nota_vegetacao
        INT nota_historico_ndvi
        INT nota_incendios
        INT nota_clima
        INT pontuacao_total
        VARCHAR classificacao_geral
        TIMESTAMP data_calculo
    }
    
    ALERTAS {
        UUID id PK
        UUID area_id FK
        VARCHAR tipo
        TEXT mensagem
        BOOLEAN lida
        TIMESTAMP data_evento
    }
    
    TERRITORIOS_PROTEGIDOS {
        INT gid PK
        VARCHAR nome_reserva
        VARCHAR tipo
        GEOMETRY geom
    }

    USUARIOS ||--o{ AREAS : "possui (1:N)"
    AREAS ||--o{ HISTORICOS_SIRI : "registra (1:N)"
    AREAS ||--o{ ALERTAS : "dispara (1:N)"