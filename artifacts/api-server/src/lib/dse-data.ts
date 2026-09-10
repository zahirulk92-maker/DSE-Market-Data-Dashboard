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

const now = new Date();
const isoNow = now.toISOString();

const demoStocks: MarketStock[] = [
  ["GP", "Telecommunication", 348.4, 346.2, 0.64, 351.8, 344.1, 1248300],
  ["SQURPHARMA", "Pharmaceuticals", 228.7, 231.4, -1.17, 232.2, 226.8, 892600],
  ["BATBC", "Food & Allied", 412.1, 408.6, 0.86, 415.4, 407.1, 421900],
  ["BRACBANK", "Bank", 61.8, 60.9, 1.48, 62.3, 60.5, 2851100],
  ["CITYBANK", "Bank", 27.6, 27.9, -1.08, 28.1, 27.3, 1634200],
  ["RENATA", "Pharmaceuticals", 1184.9, 1178.2, 0.57, 1192.4, 1171.6, 52400],
  ["LHBL", "Cement", 63.2, 62.6, 0.96, 64.1, 62.1, 749300],
  ["OLYMPIC", "Food & Allied", 173.5, 170.8, 1.58, 175.2, 171.1, 310800],
  ["SUMITPOWER", "Fuel & Power", 32.5, 33.1, -1.81, 33.2, 32.2, 1140200],
  ["BEXIMCO", "Pharmaceuticals", 118.3, 115.9, 2.07, 119.4, 116.2, 1839700],
  ["DUTCHBANGL", "Bank", 68.2, 67.8, 0.59, 69.1, 67.2, 594600],
  ["ACI", "Pharmaceuticals", 244.6, 241.3, 1.37, 247.9, 241.1, 102700],
  ["MARICO", "Food & Allied", 2681.4, 2668.1, 0.5, 2692.7, 2659.3, 8700],
  ["WALTONHIL", "Engineering", 842.8, 849.2, -0.75, 856.1, 838.7, 19100],
  ["EASTERNINS", "Insurance", 43.9, 43.2, 1.62, 44.6, 42.8, 422900],
  ["BSCCL", "Telecommunication", 151.2, 149.8, 0.93, 154.1, 148.7, 177400],
  ["IFADAUTOS", "Engineering", 42.7, 41.9, 1.91, 43.1, 41.8, 678500],
  ["KPCL", "Fuel & Power", 52.4, 53.2, -1.5, 53.7, 51.9, 322900],
].map(
  ([symbol, sector, ltp, ycp, change, high, low, volume]) =>
    ({
      symbol,
      sector,
      ltp,
      ycp,
      change,
      high,
      low,
      volume,
      updatedAt: isoNow,
    }) as MarketStock,
);

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
    updatedAt: row.updated_at ?? isoNow,
  };
}

export function getDemoStocks() {
  return demoStocks;
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
  } catch {
    // A fresh Supabase project may not have the DSE tables yet. The dashboard
    // remains useful with the clearly labeled starter market snapshot.
  }

  return demoStocks.filter((stock) => {
    const sectorMatches = !filters?.sector || stock.sector === filters.sector;
    const searchMatches =
      !filters?.search ||
      stock.symbol.toLowerCase().includes(filters.search.toLowerCase());
    return sectorMatches && searchMatches;
  });
}

function seededHistory(symbol: string): HistoryPoint[] {
  const stock = demoStocks.find((item) => item.symbol === symbol) ?? demoStocks[0];
  const seed = [...symbol].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const points: HistoryPoint[] = [];
  let close = stock.ltp * 0.76;
  const day = 86_400_000;

  for (let index = 0; index < 252; index += 1) {
    const date = new Date(now.getTime() - (251 - index) * day);
    const wave = Math.sin((index + seed) / 13) * 0.018;
    const drift = (stock.ltp * 0.24 * index) / 251;
    const open = close;
    close = Math.max(5, stock.ltp * 0.76 + drift + stock.ltp * wave);
    const high = Math.max(open, close) * (1 + 0.006 + ((index + seed) % 4) / 1000);
    const low = Math.min(open, close) * (1 - 0.006 - ((index + seed) % 3) / 1000);
    points.push({
      time: date.toISOString().slice(0, 10),
      open: Number(open.toFixed(2)),
      high: Number(high.toFixed(2)),
      low: Number(low.toFixed(2)),
      close: Number(close.toFixed(2)),
      volume: Math.round(stock.volume * (0.55 + ((index * 17 + seed) % 100) / 100)),
    });
  }

  return points;
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
  } catch {
    // Fall through to the starter history until the table is populated.
  }

  return seededHistory(symbol);
}