import { supabaseRequest } from "./supabase";

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
let localTracker: TrackerRow[] = [];
let nextRunAt = new Date(Date.now() + fiveMinutes).toISOString();

function trackerStatus(rows: TrackerRow[]): IngestionStatus {
  const inProgress = rows.find((row) => row.status === "in_progress");
  return {
    total: rows.length,
    completed: rows.filter((row) => row.status === "completed").length,
    pending: rows.filter((row) => row.status === "pending").length,
    failed: rows.filter((row) => row.status === "failed").length,
    inProgress: inProgress?.symbol || "",
    nextRunAt,
    lastSynced: "",
    lastRecords: 0,
  };
}

async function readRemoteTracker() {
  const rows = await supabaseRequest<TrackerRow[]>(
    "dse_backfill_tracker?select=symbol,status,total_records_inserted,last_updated&order=last_updated.asc&limit=500",
  );
  localTracker = rows;
  return rows;
}

export async function getIngestionStatus(): Promise<IngestionStatus> {
  try {
    const [tracker, latestRuns] = await Promise.all([
      readRemoteTracker(),
      supabaseRequest<Array<{
        finished_at?: string | null;
        records_saved?: number | null;
        symbol?: string | null;
      }>>("dse_ingestion_runs?select=finished_at,records_saved,symbol&status=eq.completed&order=finished_at.desc&limit=1"),
    ]);
    const status = trackerStatus(tracker);
    const latest = latestRuns[0];
    if (latest?.finished_at) {
      status.lastSynced = latest.symbol ?? "";
      status.lastRecords = Math.round(Number(latest.records_saved ?? 0));
      status.nextRunAt = new Date(new Date(latest.finished_at).getTime() + fiveMinutes).toISOString();
    }
    return status;
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
    return [];
  }
}

export async function startIngestion() {
  return {
    accepted: true,
    message: "The Render Python collector runs automatically every five minutes. Check the Ingestion monitor for its latest completed run.",
  };
}
