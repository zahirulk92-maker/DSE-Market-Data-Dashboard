import { supabaseRequest } from "./supabase";

export type MarketStock = {
  symbol: string;
  sector: string;
  ltp: number;
  ycp: number;
  change: number;
  high: number;
  low: number;
  volume: number;
  updatedAt: string;
};

export type HistoryPoint = {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

type SupabaseMarketRow = {
  symbol: string;
  sector?: string | null;
  ltp?: number | string | null;
  ycp?: number | string | null;
  change?: number | string | null;
  high?: number | string | null;
  low?: number | string | null;
  volume?: number | string | null;
  updated_at?: string | null;
};

type SupabaseHistoryRow = {
  trade_date: string;
  open: number | string;
  high: number | string;
  low: number | string;
  close: number | string;
  volume: number | string;
};

function numberOrZero(value: number | string | null | undefined) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function mapStock(row: SupabaseMarketRow): MarketStock {
  return {
    symbol: row.symbol,
    sector: row.sector ?? "Unclassified",
    ltp: numberOrZero(row.ltp),
    ycp: numberOrZero(row.ycp),
    change: numberOrZero(row.change),
    high: numberOrZero(row.high),
    low: numberOrZero(row.low),
    volume: Math.round(numberOrZero(row.volume)),
    updatedAt: row.updated_at ?? new Date().toISOString(),
  };
}

export async function getMarketStocks(filters?: {
  sector?: string;
  search?: string;
}) {
  try {
    const params = new URLSearchParams({
      select: "symbol,sector,ltp,ycp,change,high,low,volume,updated_at",
      order: "symbol.asc",
      limit: "500",
    });
    if (filters?.sector) params.set("sector", `eq.${filters.sector}`);
    if (filters?.search) params.set("symbol", `ilike.*${filters.search}*`);

    const rows = await supabaseRequest<SupabaseMarketRow[]>(
      `dse_market_data?${params.toString()}`,
    );
    if (rows.length > 0) return rows.map(mapStock);
    return [];
  } catch {
    return [];
  }
}

export async function getStockHistory(symbol: string) {
  try {
    const params = new URLSearchParams({
      select: "trade_date,open,high,low,close,volume",
      symbol: `eq.${symbol}`,
      order: "trade_date.asc",
      limit: "370",
    });
    const rows = await supabaseRequest<SupabaseHistoryRow[]>(
      `dse_daily_history?${params.toString()}`,
    );
    if (rows.length > 0) {
      return rows.map((row) => ({
        time: row.trade_date,
        open: numberOrZero(row.open),
        high: numberOrZero(row.high),
        low: numberOrZero(row.low),
        close: numberOrZero(row.close),
        volume: Math.round(numberOrZero(row.volume)),
      }));
    }
    return [];
  } catch {
    return [];
  }
}
