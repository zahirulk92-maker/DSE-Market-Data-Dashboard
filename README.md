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
⚙️ Installation
1. Clone the repository
git clone https://github.com/zahirulk92-maker/DSE-Market-Data-Dashboard.git
2. Enter the project
cd DSE-Market-Data-Dashboard
3. Install dependencies

This project uses pnpm.

pnpm install
▶️ Development
Start the API server
pnpm --filter @workspace/api-server run dev

The API server runs on port:

8080
Start the dashboard
pnpm --filter @workspace/dse-market-dashboard run dev
✅ Type Check
pnpm run typecheck
🏗️ Build
pnpm run build
🔄 Generate API Client

After modifying the OpenAPI specification:

pnpm --filter @workspace/api-spec run codegen
🔐 Environment Configuration

Supabase credentials are managed outside the application source code.

## Python collection engine

The Render Blueprint includes a Python Cron Job that runs every five minutes. On each run it:

- updates the current, sector-wise market snapshot for all available stocks;
- takes up to three pending symbols from the backfill queue;
- fetches at least the previous 366 days of OHLCV history for those symbols; and
- saves the snapshot, history, tracker state, and run log to Supabase.

Before deploying the collector, apply `supabase/migrations/20260911000000_create_dse_collection.sql` in the target Supabase project and add these Render environment variables to both the web service and the Cron Job:

```text
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<server-only secret>
DSE_LATEST_URL=<JSON endpoint returning all current DSE stocks>
DSE_HISTORY_URL=<JSON endpoint; supports {symbol}, {start}, and {end} placeholders>
```

`DSE_DATA_SOURCE_TOKEN` is optional for providers that require a bearer token. Never place the Supabase service-role key in the React frontend.

Do not commit API keys, database passwords, or other secrets to the repository.

🧠 Architecture

The application follows a workspace-based architecture containing separate frontend, backend, API specification, and shared project components.

The dashboard communicates with the backend API, while the backend handles database access and DSE market-data ingestion.

DSE Data Source
      │
      ▼
Ingestion Worker
      │
      ▼
PostgreSQL / Supabase
      │
      ▼
Express API
      │
      ▼
React Dashboard
      │
      ▼
Interactive Market Charts
🗺️ Roadmap

Planned improvements include:

 Live DSE market feed
 Complete historical data ingestion
 Advanced candlestick charts
 Technical indicators
 Market movers
 Top gainers and losers
 Sector performance
 Company fundamentals
 Watchlist
 Portfolio tracking
 Market alerts
 Improved analytics
 Production deployment
🇧🇩 Purpose

The goal of this project is to build a modern and extensible market-data platform focused on the Dhaka Stock Exchange (DSE) and the Bangladesh capital market.

🤝 Contributing

Contributions, bug reports, feature suggestions, and improvements are welcome.

Recommended workflow:

Create Branch
    ↓
Make Changes
    ↓
Test
    ↓
Commit
    ↓
Open Pull Request
    ↓
Review
    ↓
Merge
📄 License

This project is licensed under the MIT License.

