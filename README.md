# 📈 DSE Market Data Dashboard

A modern, dark-themed market dashboard for exploring **Dhaka Stock Exchange (DSE)** market data, stock history, OHLCV charts, market breadth, and automated data ingestion.

## 🚀 Overview

DSE Market Data Dashboard is designed to provide a clean and powerful interface for monitoring Bangladesh stock market data.

The application includes:

- 📊 DSE market overview
- 🔎 Searchable stock list
- 🏢 Sector-based stock information
- 📈 Historical price charts
- 🕯️ OHLC / Candlestick data
- 📦 Trading volume visualization
- ❤️ API health monitoring
- 🔄 Automated market-data ingestion
- ⏱️ Rate-limited background worker
- 🗄️ PostgreSQL / Supabase-backed storage

## ✨ Features

### Market Dashboard

View overall DSE market activity from a modern TradingView-inspired interface.

### Stock Search

Quickly search and select listed companies to inspect their market information.

### Historical Data

Selecting a stock can load historical market data including:

- Open
- High
- Low
- Close
- Volume

### Interactive Charts

The dashboard supports interactive market visualization using Lightweight Charts.

### Data Ingestion Worker

A background ingestion system processes stock symbols in controlled cycles.

The worker is designed to:

- Process symbols sequentially
- Respect data-source rate limits
- Track ingestion progress
- Record failed symbols
- Continue processing even when an individual symbol fails

## 🛠️ Tech Stack

### Frontend

- React
- TypeScript
- Lightweight Charts

### Backend

- Node.js
- Express 5
- TypeScript

### Database

- PostgreSQL
- Supabase
- Drizzle ORM

### Validation & API

- Zod
- drizzle-zod
- OpenAPI
- Orval

### Tooling

- pnpm Workspaces
- TypeScript
- esbuild
- Prettier

## 📁 Project Structure

```text
DSE-Market-Data-Dashboard/
├── artifacts/
│   ├── dse-market-dashboard/    # Dashboard frontend
│   └── api-server/              # Backend API
│
├── lib/
│   └── api-spec/                # OpenAPI specification
│
├── scripts/                     # Project scripts
├── package.json
├── pnpm-workspace.yaml
└── tsconfig.base.json
