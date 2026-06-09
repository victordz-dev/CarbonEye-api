# 🛰️ CarbonEye — API Backend

<div align="center">

**Plataforma de Monitoramento Ambiental com Inteligência Geoespacial**

[![NestJS](https://img.shields.io/badge/NestJS-E0234E?style=for-the-badge&logo=nestjs&logoColor=white)](https://nestjs.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![PostGIS](https://img.shields.io/badge/PostGIS-3C873A?style=for-the-badge&logo=postgresql&logoColor=white)](https://postgis.net/)

[Swagger (Produção)](https://carboneye-api.onrender.com/api/docs) · [Frontend Mobile](https://github.com/victordz-dev/CarbonEye-mobile) · [Documentação Completa](./docs)

</div>

---

## 📋 Sobre o Projeto

O **CarbonEye** é uma plataforma digital de análise e monitoramento ambiental que utiliza dados de **sensoriamento remoto**, **geoprocessamento vetorial** e **inteligência climática** para avaliar o risco ecológico de áreas rurais ou ambientais no território brasileiro.

Este repositório contém o **backend (BFF — Backend For Frontend)**, construído em **NestJS + TypeScript**, que centraliza:

- 🗺️ **Geoprocessamento vetorial** via PostgreSQL/PostGIS (cálculo de área, interseção territorial, extração de coordenadas)
- 🛰️ **Integrações com satélites** (AgroMonitoring, NASA FIRMS, OpenWeather)
- 📊 **Cálculo do índice SIRI** — Satellite Environmental Risk Index (pontuação 0-100)
- 🔥 **Monitoramento contínuo** com Cron Jobs e alertas automáticos via Push Notification
- 📄 **Geração de laudos ambientais em PDF** dinâmicos com `pdfkit`

> 🔗 **Frontend Mobile (React Native + Expo):** [github.com/victordz-dev/CarbonEye-mobile](https://github.com/victordz-dev/CarbonEye-mobile)

---

## 🏗️ Arquitetura

O projeto segue uma **Arquitetura Modular** inspirada em DDD (Domain-Driven Design) com separação de responsabilidades:

```
src/
├── decorators/          # @GetUser — Decorator tipado para JWT
├── entities/            # Entidades TypeORM (herdam de EntidadeBase abstrata)
├── filters/             # AllExceptionsFilter global
├── modules/
│   ├── auth/            # Autenticação JWT, registro, perfil
│   ├── areas/           # Core: análise, salvamento, monitoramento, PDF
│   ├── alertas/         # Central de notificações e CRUD de alertas
│   ├── geo/             # GeoService + PostGIS (cálculos espaciais)
│   ├── integrations/    # Proxy para APIs externas com cache
│   ├── logs/            # Auditoria de ações (frontend + backend)
│   ├── notifications/   # Expo Push Notifications
│   ├── siri/            # Motor de cálculo SIRI (índice ambiental)
│   └── tasks/           # Cron Jobs: varredura, fogo, clima, GC
└── main.ts              # Bootstrap com Helmet + Throttler
```

### Tecnologias Principais

| Camada | Tecnologia |
|---|---|
| Framework | NestJS (TypeScript strict) |
| Banco de Dados | PostgreSQL + PostGIS |
| ORM | TypeORM com Transactions |
| Autenticação | JWT + Passport + bcrypt |
| Validação | Zod (via nestjs-zod) |
| Cron Jobs | @nestjs/schedule |
| Segurança | Helmet + @nestjs/throttler |
| Cache | @nestjs/cache-manager (in-memory) |
| PDF | pdfkit |
| Push Notifications | Expo Push API |
| Deploy | Render (Free Tier) |

---

## 📖 Documentação Técnica

A pasta [`/docs`](./docs) contém a documentação completa do sistema:

| Documento | Descrição |
|---|---|
| [Visão do Produto](./docs/Visão%20Do%20Produto.md) | Problemática, objetivos, público-alvo e proposta de valor |
| [Arquitetura Backend](./docs/Arquitetura%20Backend.md) | Stack tecnológico, estrutura modular DDD e pipeline de processamento |
| [SIRI — Índice Ambiental](./docs/SIRI.md) | Metodologia completa de cálculo (pesos, fórmulas e classificação) |
| [Regras de Negócio](./docs/Regras%20de%20Negócio.md) | RN01-RN11: cotas, limites, validação territorial e monitoramento |
| [Requisitos Funcionais e Não Funcionais](./docs/Requisitos%20Funcionais%20e%20Não%20Funcionais.md) | RF01-RF26 e RNF01-RNF19 |
| [Casos de Uso](./docs/Use%20Cases.md) | UC01-UC05 com fluxos principais e de exceção |
| [Contratos de API](./docs/Contratos%20de%20API%20RestFul.md) | Especificação REST completa de todos os endpoints |
| [Diagrama MER](./docs/Diagrama%20MER.md) | Modelo Entidade-Relacionamento com herança e PostGIS |
| [Diagramas de Fluxo](./docs/Diagramas%20de%20Fluxo.md) | Fluxos de triagem, cron jobs, autenticação e cálculo SIRI |
| [Limitações e Premissas](./docs/Limitações%20e%20Premissas.md) | Restrições técnicas e financeiras do sistema |
| [Evidências de Execução](./docs/prints/) | Prints de Evidências do projeto na Nuvem |

---

## 🚀 API em Produção

O projeto está em **deploy contínuo** e disponível para teste:

- **URL Base:** `https://carboneye-api.onrender.com`
- **Swagger UI:** [https://carboneye-api.onrender.com/api/docs](https://carboneye-api.onrender.com/api/docs)

> ⚠️ O Render Free Tier hiberna após 15min de inatividade. A primeira requisição pode levar ~50 segundos.

---

## ⚙️ Executando Localmente

### Pré-requisitos
- Node.js >= 18
- PostgreSQL com extensão PostGIS habilitada
- Variáveis de ambiente configuradas (ver `.env.example`)

### Instalação

```bash
# Clone o repositório
git clone https://github.com/victordz-dev/CarbonEye-api.git
cd CarbonEye-api

# Instale as dependências
npm install

# Configure as variáveis de ambiente
cp .env.example .env

# Execute em modo de desenvolvimento
npm run dev
```

### Scripts Disponíveis

| Comando | Descrição |
|---|---|
| `npm run dev` | Inicia em modo desenvolvimento (watch) |
| `npm run build` | Build de produção |
| `npm run start:prod` | Executa o build de produção |
| `npm run test` | Executa os testes unitários |
| `npm run lint` | Lint com ESLint |

---

## 🧪 Testes

```bash
# Testes unitários
npm run test

# Testes com watch mode
npm run test:watch

# Coverage
npm run test:cov
```

---

## 📸 Evidências de Execução

> Os links abaixo demonstram o sistema funcionando em produção:

- 🔗 [API ativa em produção (Swagger UI)](https://carboneye-api.onrender.com/api/docs)
- 📱 [Frontend Mobile consumindo a API](https://github.com/victordz-dev/CarbonEye-mobile)

---

## 👥 Integrantes da Equipe

| Nome | RM |
|---|---|
| Guilherme Oliveira | 558797 |
| Matheus Dantas | 558804 |
| Rafael Panhoca | 555014 |
| Silas Alves | 555020 |
| Victor Rodriguez | 559094 |
