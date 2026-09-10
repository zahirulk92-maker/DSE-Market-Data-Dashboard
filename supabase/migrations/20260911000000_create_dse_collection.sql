create table if not exists public.dse_market_data (
  symbol text primary key,
  sector text not null default 'Unclassified',
  ltp numeric not null default 0,
  ycp numeric not null default 0,
  change numeric not null default 0,
  high numeric not null default 0,
  low numeric not null default 0,
  volume bigint not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.dse_daily_history (
  symbol text not null,
  trade_date date not null,
  open numeric not null default 0,
  high numeric not null default 0,
  low numeric not null default 0,
  close numeric not null default 0,
  volume bigint not null default 0,
  primary key (symbol, trade_date)
);

create table if not exists public.dse_backfill_tracker (
  symbol text primary key,
  status text not null default 'pending' check (status in ('pending', 'in_progress', 'completed', 'failed')),
  total_records_inserted integer not null default 0,
  last_updated timestamptz not null default now()
);

create table if not exists public.dse_ingestion_runs (
  id bigint generated always as identity primary key,
  started_at timestamptz not null,
  finished_at timestamptz,
  status text not null check (status in ('completed', 'failed')),
  message text not null,
  records_saved integer not null default 0,
  symbol text
);

create index if not exists dse_daily_history_symbol_date_idx on public.dse_daily_history (symbol, trade_date desc);
create index if not exists dse_ingestion_runs_started_at_idx on public.dse_ingestion_runs (started_at desc);

alter table public.dse_market_data enable row level security;
alter table public.dse_daily_history enable row level security;
alter table public.dse_backfill_tracker enable row level security;
alter table public.dse_ingestion_runs enable row level security;
