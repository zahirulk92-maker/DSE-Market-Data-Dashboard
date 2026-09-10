"""Scheduled DSE collector: current market snapshot plus historical backfill."""
from __future__ import annotations

import json
import os
import signal
import sys
import threading
from datetime import date, datetime, timedelta, timezone
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from bdshare import get_current_trade_data, get_historical_data


SUPABASE_URL = os.environ["SUPABASE_URL"].rstrip("/")
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
BATCH_SIZE = max(1, int(os.environ.get("DSE_BACKFILL_BATCH_SIZE", "3")))
INTERVAL_SECONDS = max(60, int(os.environ.get("DSE_COLLECTION_INTERVAL_SECONDS", "300")))
STOP_REQUESTED = threading.Event()


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


def api_request(url: str, method: str = "GET", payload: Any = None, headers: dict[str, str] | None = None) -> Any:
    body = None if payload is None else json.dumps(payload).encode()
    request_headers = {"Accept": "application/json", "User-Agent": "DSE-Market-Data-Dashboard/1.0"}
    if body is not None:
        request_headers["Content-Type"] = "application/json"
    request_headers.update(headers or {})
    request = Request(url, data=body, method=method, headers=request_headers)
    try:
        with urlopen(request, timeout=45) as response:
            raw = response.read().decode()
            return None if not raw else json.loads(raw)
    except (HTTPError, URLError, TimeoutError, json.JSONDecodeError) as error:
        raise RuntimeError(f"Request failed for {url}: {error}") from error


def supabase(path: str, method: str = "GET", payload: Any = None, prefer: str | None = None) -> Any:
    headers = {"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}"}
    if prefer:
        headers["Prefer"] = prefer
    return api_request(f"{SUPABASE_URL}/rest/v1/{path}", method, payload, headers)


def rows(payload: Any) -> list[dict[str, Any]]:
    if isinstance(payload, list):
        return [item for item in payload if isinstance(item, dict)]
    if isinstance(payload, dict):
        for key in ("data", "results", "items"):
            value = payload.get(key)
            if isinstance(value, list):
                return [item for item in value if isinstance(item, dict)]
    return []


def field(row: dict[str, Any], *names: str, default: Any = None) -> Any:
    normalized = {str(key).lower().replace(" ", "_").replace("*", ""): value for key, value in row.items()}
    for name in names:
        value = normalized.get(name.lower().replace(" ", "_").replace("*", ""))
        if value not in (None, ""):
            return value
    return default


def number(value: Any) -> float:
    try:
        return float(str(value).replace(",", ""))
    except (TypeError, ValueError):
        return 0.0


def current_stocks() -> list[dict[str, Any]]:
    payload = get_current_trade_data().to_dict(orient="records")
    result = []
    for row in rows(payload):
        symbol = str(field(row, "symbol", "trading_code", "code", "ticker", default="")).strip().upper()
        if not symbol:
            continue
        ltp = number(field(row, "ltp", "last_traded_price", "close", "closep", default=0))
        ycp = number(field(row, "ycp", "previous_close", default=0))
        result.append({"symbol": symbol, "sector": str(field(row, "sector", "category", default="Unclassified")), "ltp": ltp, "ycp": ycp, "change": number(field(row, "change", "price_change", default=ltp - ycp)), "high": number(field(row, "high", default=ltp)), "low": number(field(row, "low", default=ltp)), "volume": int(number(field(row, "volume", default=0))), "updated_at": now()})
    if not result:
        raise RuntimeError("bdshare returned no recognizable DSE stock rows")
    return result


def history_for(symbol: str) -> list[dict[str, Any]]:
    end = date.today()
    start = end - timedelta(days=366)
    payload = get_historical_data(start.isoformat(), end.isoformat(), symbol).reset_index().to_dict(orient="records")
    result = []
    for row in payload:
        trade_date = str(field(row, "trade_date", "date", "trading_date", default=""))[:10]
        if not trade_date:
            continue
        result.append({"symbol": symbol, "trade_date": trade_date, "open": number(field(row, "open", default=0)), "high": number(field(row, "high", default=0)), "low": number(field(row, "low", default=0)), "close": number(field(row, "close", "closep", "ltp", default=0)), "volume": int(number(field(row, "volume", default=0)))})
    return result


def write_run(status: str, message: str, records: int = 0, symbol: str | None = None) -> None:
    supabase("dse_ingestion_runs", "POST", {"started_at": now(), "finished_at": now(), "status": status, "message": message, "records_saved": records, "symbol": symbol}, "return=minimal")


def main() -> None:
    stocks = current_stocks()
    supabase("dse_market_data?on_conflict=symbol", "POST", stocks, "resolution=merge-duplicates,return=minimal")
    tracker_rows = [{"symbol": stock["symbol"], "status": "pending", "total_records_inserted": 0, "last_updated": now()} for stock in stocks]
    supabase("dse_backfill_tracker?on_conflict=symbol", "POST", tracker_rows, "resolution=ignore-duplicates,return=minimal")
    pending = supabase(f"dse_backfill_tracker?status=in.(pending,failed)&select=symbol&order=last_updated.asc&limit={BATCH_SIZE}") or []
    saved = 0
    for tracker in pending:
        symbol = tracker["symbol"]
        try:
            supabase(f"dse_backfill_tracker?symbol=eq.{symbol}", "PATCH", {"status": "in_progress", "last_updated": now()}, "return=minimal")
            history = history_for(symbol)
            if history:
                supabase("dse_daily_history?on_conflict=symbol,trade_date", "POST", history, "resolution=merge-duplicates,return=minimal")
            saved += len(history)
            supabase(f"dse_backfill_tracker?symbol=eq.{symbol}", "PATCH", {"status": "completed", "total_records_inserted": len(history), "last_updated": now()}, "return=minimal")
            write_run("completed", "Historical backfill completed", len(history), symbol)
        except Exception as error:
            supabase(f"dse_backfill_tracker?symbol=eq.{symbol}", "PATCH", {"status": "failed", "last_updated": now()}, "return=minimal")
            write_run("failed", str(error)[:500], 0, symbol)
    write_run("completed", f"Updated {len(stocks)} current market rows", saved)


if __name__ == "__main__":
    def stop_loop(_signal: int, _frame: Any) -> None:
        STOP_REQUESTED.set()

    signal.signal(signal.SIGTERM, stop_loop)
    signal.signal(signal.SIGINT, stop_loop)
    while not STOP_REQUESTED.is_set():
        try:
            main()
        except Exception as error:
            print(f"collector failed: {error}", file=sys.stderr)
        if "--loop" not in sys.argv:
            break
        STOP_REQUESTED.wait(INTERVAL_SECONDS)
