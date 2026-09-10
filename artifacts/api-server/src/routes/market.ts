import { Router, type IRouter } from "express";
import {
  GetIngestionStatusResponse,
  GetIngestionTrackerResponse,
  GetIngestionLogsResponse,
  GetMarketOverviewResponse,
  GetMarketStocksQueryParams,
  GetMarketStocksResponse,
  GetStockHistoryParams,
  GetStockHistoryResponse,
  StartIngestionResponse,
} from "@workspace/api-zod";
import { getMarketStocks } from "../lib/dse-data";
import {
  getIngestionLogs,
  getIngestionStatus,
  getIngestionTracker,
  startIngestion,
} from "../lib/ingestion";

const router: IRouter = Router();

router.get("/market/overview", async (_req, res) => {
  const stocks = await getMarketStocks();
  const ingestion = await getIngestionStatus();
  const sectors = [...new Set(stocks.map((stock) => stock.sector))].sort();
  res.json(
    GetMarketOverviewResponse.parse({
      market: "DSE",
      asOf: new Date().toISOString(),
      stocks,
      sectors,
      ingestion,
    }),
  );
});

router.get("/market/stocks", async (req, res) => {
  const parsed = GetMarketStocksQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid market filters" });
    return;
  }

  const stocks = await getMarketStocks(parsed.data);
  res.json(GetMarketStocksResponse.parse(stocks));
});

router.get("/market/stocks/:symbol/history", async (req, res) => {
  const parsed = GetStockHistoryParams.safeParse(req.params);
  if (!parsed.success || !/^[A-Z0-9.&_-]{1,24}$/i.test(parsed.data.symbol)) {
    res.status(400).json({ error: "Invalid stock symbol" });
    return;
  }

  const { getStockHistory } = await import("../lib/dse-data");
  const history = await getStockHistory(parsed.data.symbol.toUpperCase());
  res.json(GetStockHistoryResponse.parse(history));
});

router.get("/market/ingestion", async (_req, res) => {
  res.json(GetIngestionStatusResponse.parse(await getIngestionStatus()));
});

router.post("/market/ingestion", async (_req, res) => {
  const result = await startIngestion();
  res.status(202).json(StartIngestionResponse.parse(result));
});

router.get("/market/ingestion/tracker", async (_req, res) => {
  res.json(GetIngestionTrackerResponse.parse(await getIngestionTracker()));
});

router.get("/market/ingestion/logs", (_req, res) => {
  res.json(GetIngestionLogsResponse.parse(getIngestionLogs()));
});

export default router;