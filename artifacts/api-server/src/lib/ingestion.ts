import { logger } from "./logger";
import { supabaseRequest } from "./supabase";
import { getDemoStocks } from "./dse-data";

type TrackerRow = {
  symbol: string;
  status: "pending" | "in_progress" | "completed" | "failed";
  total_records_inserted?: number | null;
  last_updated?: string | null;
};

export type IngestionStatus = {
  total: number;
  completed: number;
  pending: number;
  failed: number;
  inProgress: string;
  nextRunAt: string;
  lastSynced: string;
  lastRecords: number;
};

const fiveMinutes = 5 * 60 * 1000;
let workerRunning = false;
let workerStarted = false;
let localTracker: TrackerRow[] = getDemoStocks().map((stock, index) => ({
  symbol: stock.symbol,
  status: index < 5 ? "completed" : "pending",
  total_records_inserted: index < 5 ? 252 : 0,
  last_updated: new Date(Date.now() - index * 86_400_000).toISOString(),
}));
let lastSynced = "SQURPHARMA";
let lastRecords = 252;
let nextRunAt = new Date(Date.now() + fiveMinutes).toISOString();

function trackerStatus(rows: TrackerRow[]): IngestionStatus {
  const inProgress = rows.find((row) => row.status === "in_progress");
  return {
    total: rows.length,
    completed: rows.filter((row) => row.status === "completed").length,
    pending: rows.filter((row) => row.status === "pending").length,
    failed: rows.filter((row) => row.status === "failed").length,
    inProgress: inProgress?.symbol ?? "",
    nextRunAt,
    lastSynced,
    lastRecords,
  };
}

async function readRemoteTracker() {
  const rows = await supabaseRequest<TrackerRow[]>(
    "dse_backfill_tracker?select=symbol,status,total_records_inserted,last_updated&order=last_updated.asc&limit=500",
  );
  if (rows.length > 0) {
    localTracker = rows;
    return rows;
  }
  return localTracker;
}

export async function getIngestionStatus(): Promise<IngestionStatus> {
  try {
    return trackerStatus(await readRemoteTracker());
  } catch {
    return trackerStatus(localTracker);
  }
}

async function seedRemoteTracker() {
  try {
    const current = await supabaseRequest<TrackerRow[]>(
      "dse_backfill_tracker?select=symbol,status,total_records_inserted,last_updated&limit=1",
    );
    if (current.length > 0) return;

    const symbols = getDemoStocks().map((stock) => ({
      symbol: stock.symbol,
      status: "pending",
      total_records_inserted: 0,
      last_updated: new Date().toISOString(),
    }));
    await supabaseRequest("dse_backfill_tracker", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify(symbols),
    });
  } catch {
    // The API can still be used while the remote tables are being provisioned.
  }
}

async function scrapeSymbol(symbol: string) {
  const endpoint = process.env.DSE_HISTORY_ENDPOINT;
  if (!endpoint) {
    throw new Error("DSE_HISTORY_ENDPOINT is not configured");
  }

  const response = await fetch(
    endpoint.replace("{symbol}", encodeURIComponent(symbol)),
    { signal: AbortSignal.timeout(30_000) },
  );
  if (!response.ok) {
    throw new Error(`DSE endpoint returned ${response.status}`);
  }

  const payload = (await response.json()) as Array<{
    trade_date: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    sector?: string;
  }>;
  return payload.map((row) => ({ ...row, symbol }));
}

async function processNextSymbol() {
  if (workerRunning) return;
  workerRunning = true;
  let symbol = "";

  try {
    const rows = await readRemoteTracker().catch(() => localTracker);
    const next = rows.find((row) => row.status === "pending");
    if (!next) return;

    symbol = next.symbol;
    next.status = "in_progress";
    next.last_updated = new Date().toISOString();

    const history = await scrapeSymbol(symbol);
    if (history.length > 0) {
      await supabaseRequest("dse_daily_history", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates" },
        body: JSON.stringify(history),
      });
    }

    next.status = "completed";
    next.total_records_inserted = history.length;
    lastSynced = symbol;
    lastRecords = history.length;
    await supabaseRequest(`dse_backfill_tracker?symbol=eq.${encodeURIComponent(symbol)}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        status: "completed",
        total_records_inserted: history.length,
        last_updated: new Date().toISOString(),
      }),
    });
  } catch (error) {
    if (symbol) {
      const failed = localTracker.find((row) => row.symbol === symbol);
      if (failed) {
        failed.status = "failed";
        failed.last_updated = new Date().toISOString();
      }
      logger.warn({ symbol, error }, "DSE ingestion cycle failed");
    } else {
      logger.warn({ error }, "DSE ingestion worker could not select a symbol");
    }
  } finally {
    workerRunning = false;
    nextRunAt = new Date(Date.now() + fiveMinutes).toISOString();
  }
}

export async function startIngestion() {
  await seedRemoteTracker();
  if (!workerStarted) {
    workerStarted = true;
    setTimeout(() => void processNextSymbol(), 1_000);
    setInterval(() => void processNextSymbol(), fiveMinutes);
  }
  return {
    accepted: true,
    message: "Ingestion worker scheduled. One symbol will be processed every five minutes.",
  };
}

void startIngestion();