import { logger } from "./logger";
import { supabaseRequest } from "./supabase";
import { getDemoStocks } from "./dse-data";

export type TrackerRow = {
  symbol: string;
  status: "pending" | "in_progress" | "completed" | "failed";
  total_records_inserted?: number | null;
  last_updated?: string | null;
};

export type IngestionLog = {
  time: string;
  symbol: string;
  status: string;
  message: string;
  records: number;
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
let activeSymbol = "";
let localTracker: TrackerRow[] = getDemoStocks().map((stock, index) => ({
  symbol: stock.symbol,
  status: index < 5 ? "completed" : "pending",
  total_records_inserted: index < 5 ? 252 : 0,
  last_updated: new Date(Date.now() - index * 86_400_000).toISOString(),
}));
let lastSynced = "SQURPHARMA";
let lastRecords = 252;
let nextRunAt = new Date(Date.now() + fiveMinutes).toISOString();
const ingestionLogs: IngestionLog[] = [
  {
    time: new Date().toISOString(),
    symbol: "—",
    status: "info",
    message: "Worker ready. Waiting for the next ingestion cycle.",
    records: 0,
  },
];

function addLog(
  symbol: string,
  status: string,
  message: string,
  records = 0,
) {
  ingestionLogs.unshift({
    time: new Date().toISOString(),
    symbol,
    status,
    message,
    records,
  });
  ingestionLogs.splice(30);
}

function trackerStatus(rows: TrackerRow[]): IngestionStatus {
  const inProgress = rows.find((row) => row.status === "in_progress");
  return {
    total: rows.length,
    completed: rows.filter((row) => row.status === "completed").length,
    pending: rows.filter((row) => row.status === "pending").length,
    failed: rows.filter((row) => row.status === "failed").length,
    inProgress: activeSymbol || inProgress?.symbol || "",
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

export async function getIngestionTracker() {
  const rows = await readRemoteTracker().catch(() => localTracker);
  return rows.map((row) => ({
    symbol: row.symbol,
    status: row.status,
    totalRecordsInserted: Math.round(Number(row.total_records_inserted ?? 0)),
    lastUpdated: row.last_updated ?? new Date().toISOString(),
  }));
}

export async function getIngestionLogs() {
  try {
    const rows = await supabaseRequest<Array<{
      started_at: string;
      finished_at?: string | null;
      status: string;
      message: string;
      records_saved?: number | null;
      symbol?: string | null;
    }>>(
      "dse_ingestion_runs?select=started_at,finished_at,status,message,records_saved,symbol&order=started_at.desc&limit=30",
    );
    return rows.map((row) => ({
      time: row.finished_at ?? row.started_at,
      symbol: row.symbol ?? "—",
      status: row.status,
      message: row.message,
      records: Math.round(Number(row.records_saved ?? 0)),
    }));
  } catch {
    return ingestionLogs;
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
  nextRunAt = new Date(Date.now() + fiveMinutes).toISOString();

  try {
    const rows = await readRemoteTracker().catch(() => localTracker);
    const next = rows.find((row) => row.status === "pending");
    if (!next) {
      addLog("—", "idle", "No pending symbols in the backfill queue.");
      return;
    }

    symbol = next.symbol;
    activeSymbol = symbol;
    next.status = "in_progress";
    next.last_updated = new Date().toISOString();
    addLog(symbol, "running", "Started fetching one-year OHLCV history.");
    await supabaseRequest(`dse_backfill_tracker?symbol=eq.${encodeURIComponent(symbol)}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        status: "in_progress",
        last_updated: next.last_updated,
      }),
    }).catch(() => undefined);

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
    addLog(symbol, "completed", `Stored ${history.length} historical records.`, history.length);
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
      addLog(symbol, "failed", error instanceof Error ? error.message : "Unknown ingestion error.");
      await supabaseRequest(`dse_backfill_tracker?symbol=eq.${encodeURIComponent(symbol)}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({
          status: "failed",
          last_updated: new Date().toISOString(),
        }),
      }).catch(() => undefined);
      logger.warn({ symbol, error }, "DSE ingestion cycle failed");
    } else {
      logger.warn({ error }, "DSE ingestion worker could not select a symbol");
    }
  } finally {
    activeSymbol = "";
    workerRunning = false;
    nextRunAt = new Date(Date.now() + fiveMinutes).toISOString();
  }
}

export async function startIngestion() {
  return {
    accepted: true,
    message: "The Render Python collector runs automatically every five minutes. Check the Ingestion monitor for its latest completed run.",
  };
}
