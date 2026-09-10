# DSE Market Dashboard

Dark operator dashboard for browsing Dhaka Stock Exchange market snapshots, OHLCV history, and five-minute ingestion progress.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/dse-market-dashboard run dev` — run the dashboard preview
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- Supabase is accessed through the connected Replit connector; no Supabase key is stored in the repo.
- Optional `DSE_HISTORY_ENDPOINT` may contain a `{symbol}` placeholder for the live history endpoint used by the worker.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/dse-market-dashboard/src/pages/market-dashboard.tsx` — dashboard UI and Lightweight Charts renderer
- `artifacts/api-server/src/routes/market.ts` — market and ingestion API routes
- `artifacts/api-server/src/lib/dse-data.ts` — Supabase reads plus starter snapshot fallback
- `artifacts/api-server/src/lib/ingestion.ts` — five-minute ingestion worker and tracker state
- `lib/api-spec/openapi.yaml` — API contract source of truth

## Architecture decisions

- The dashboard reads Supabase through the Replit connector proxy so credentials stay managed outside application code.
- The API falls back to a clearly seeded market snapshot until the requested Supabase tables are populated.
- Ingestion processes one symbol per five-minute cycle and marks failed symbols without stopping the queue.

## Product

The dashboard shows DSE market breadth, searchable sector stock data, selectable line or OHLC history with volume, API health, and ingestion queue progress. Clicking a stock loads its one-year history; the worker endpoint starts or resumes the queue.

## User preferences

The user asked for a dark TradingView/StockNow-inspired DSE dashboard with Supabase-backed tables and a rate-limited ingestion worker.

## Gotchas

- Run API codegen after changing `lib/api-spec/openapi.yaml`.
- The worker needs `DSE_HISTORY_ENDPOINT` before it can ingest live DSE history; without it, the dashboard remains usable but the cycle is marked failed.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
