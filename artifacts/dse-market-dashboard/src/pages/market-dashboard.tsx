import { useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  CandlestickSeries,
  ColorType,
  HistogramSeries,
  LineSeries,
  createChart,
} from 'lightweight-charts';
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Check,
  ChevronDown,
  Clock3,
  Database,
  Download,
  LineChart,
  LoaderCircle,
  Menu,
  Play,
  RefreshCw,
  Search,
  Server,
  SlidersHorizontal,
  TrendingUp,
  X,
  Zap,
} from 'lucide-react';
import {
  getGetIngestionStatusQueryKey,
  getGetIngestionLogsQueryKey,
  getGetIngestionTrackerQueryKey,
  getGetMarketOverviewQueryKey,
  getGetMarketStocksQueryKey,
  getGetStockHistoryQueryKey,
  getHealthCheckQueryKey,
  useGetIngestionLogs,
  useGetIngestionStatus,
  useGetIngestionTracker,
  useGetMarketOverview,
  useGetMarketStocks,
  useGetStockHistory,
  useHealthCheck,
  useStartIngestion,
} from '@workspace/api-client-react';
import type { HistoryPoint, IngestionLog, IngestionStatus, IngestionTrackerRow, MarketStock } from '@workspace/api-client-react';
import { useLocation } from 'wouter';
import { Sidebar } from '@/components/sidebar';

const numberFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
const compactFormat = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });

function formatNumber(value: number | undefined) {
  return value === undefined || Number.isNaN(value) ? '—' : numberFormat.format(value);
}

function formatCompact(value: number | undefined) {
  return value === undefined || Number.isNaN(value) ? '—' : compactFormat.format(value);
}

function formatDate(value: string | undefined, withTime = true) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-GB', withTime ? {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  } : { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
}

function formatCountdown(totalSeconds: number) {
  const safeSeconds = Math.max(0, totalSeconds);
  return `${String(Math.floor(safeSeconds / 60)).padStart(2, '0')}:${String(safeSeconds % 60).padStart(2, '0')}`;
}

function valueTone(value: number) {
  return value > 0 ? 'positive' : value < 0 ? 'negative' : 'neutral';
}

function ToneValue({ value, prefix = '', suffix = '' }: { value: number; prefix?: string; suffix?: string }) {
  const tone = valueTone(value);
  return (
    <span className={`font-mono tabular-nums ${tone === 'positive' ? 'text-emerald-700' : tone === 'negative' ? 'text-rose-700' : 'text-muted-foreground'}`}>
      {value > 0 ? '+' : ''}{prefix}{formatNumber(value)}{suffix}
    </span>
  );
}

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-secondary ${className}`} />;
}

function EmptyState({ title, detail, compact = false }: { title: string; detail: string; compact?: boolean }) {
  return (
    <div className={`flex flex-col items-center justify-center text-center ${compact ? 'py-10' : 'min-h-[240px] py-16'}`}>
      <div className="mb-3 grid size-10 place-items-center rounded-full border border-border bg-muted text-muted-foreground">
        <Database size={17} strokeWidth={1.7} />
      </div>
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="mt-1 max-w-xs text-xs leading-5 text-muted-foreground">{detail}</p>
    </div>
  );
}

function ErrorState({ onRetry, detail = 'The market feed did not respond.' }: { onRetry: () => void; detail?: string }) {
  return (
    <div className="flex min-h-[170px] flex-col items-center justify-center text-center">
      <AlertTriangle size={19} className="mb-3 text-rose-600" />
      <p className="text-sm font-semibold text-foreground">Feed unavailable</p>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
      <button data-testid="button-retry-feed" onClick={onRetry} className="mt-4 inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground transition-colors hover:border-primary hover:bg-muted">
        <RefreshCw size={13} /> Retry feed
      </button>
    </div>
  );
}

function MarketChart({
  points,
  loading,
  mode,
}: {
  points: HistoryPoint[] | undefined;
  loading: boolean;
  mode: 'line' | 'candles';
}) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const dataPoints = points ?? [];
  const closeValues = dataPoints.map((point) => point.close);
  const periodChange = closeValues[closeValues.length - 1] - closeValues[0];

  useEffect(() => {
    if (!chartContainerRef.current) return;
    if (!dataPoints.length) return;
    const container = chartContainerRef.current;
    const chart = createChart(container, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#667085',
        fontFamily: 'DM Mono, monospace',
        fontSize: 10,
      },
      grid: {
        vertLines: { color: 'rgba(218, 224, 232, 0.55)' },
        horzLines: { color: 'rgba(218, 224, 232, 0.55)' },
      },
      rightPriceScale: {
        borderColor: 'rgba(218, 224, 232, 0.8)',
        scaleMargins: { top: 0.08, bottom: 0.3 },
      },
      timeScale: {
        borderColor: 'rgba(218, 224, 232, 0.8)',
        timeVisible: false,
      },
      crosshair: { vertLine: { labelVisible: true }, horzLine: { labelVisible: true } },
    });

    const priceSeries = mode === 'candles'
      ? chart.addSeries(CandlestickSeries, {
        upColor: '#2f8f74',
        downColor: '#d85c51',
        borderVisible: false,
        wickUpColor: '#2f8f74',
        wickDownColor: '#d85c51',
      })
      : chart.addSeries(LineSeries, {
        color: periodChange >= 0 ? '#2f8f74' : '#d85c51',
        lineWidth: 2,
        crosshairMarkerVisible: true,
        priceLineVisible: false,
      });

    if (mode === 'candles') {
      priceSeries.setData(dataPoints.map((point) => ({
        time: point.time,
        open: point.open,
        high: point.high,
        low: point.low,
        close: point.close,
      })));
    } else {
      priceSeries.setData(dataPoints.map((point) => ({ time: point.time, value: point.close })));
    }

    const volumeSeries = chart.addSeries(HistogramSeries, {
      color: '#98a8b8',
      priceFormat: { type: 'volume' },
      priceScaleId: '',
    });
    volumeSeries.priceScale().applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
    volumeSeries.setData(dataPoints.map((point) => ({
      time: point.time,
      value: point.volume,
      color: point.close >= point.open ? 'rgba(47, 143, 116, 0.45)' : 'rgba(216, 92, 81, 0.45)',
    })));
    chart.timeScale().fitContent();

    return () => chart.remove();
  }, [mode, periodChange, points]);

  if (loading) {
    return <div className="space-y-3"><Skeleton className="h-[250px] w-full" /><div className="flex justify-between"><Skeleton className="h-3 w-16" /><Skeleton className="h-3 w-16" /><Skeleton className="h-3 w-16" /></div></div>;
  }
  if (!points?.length) return <EmptyState title="No history for this symbol" detail="Select an active symbol to load its daily OHLCV series." />;

  return (
    <div className="relative">
      <div ref={chartContainerRef} className="h-[300px] w-full" aria-label={`${mode === 'candles' ? 'Candlestick' : 'Line'} historical price chart with volume`} />
      <div className="ml-10 mt-2 flex justify-between text-[10px] text-muted-foreground">
        <span>{formatDate(points?.[0]?.time, false)}</span>
        <span>{formatDate(points?.[Math.floor((points.length - 1) / 2)]?.time, false)}</span>
        <span>{formatDate(points?.[points.length - 1]?.time, false)}</span>
      </div>
    </div>
  );
}

function IngestionCard({ ingestion, loading, onStart, pending, countdown, running }: { ingestion?: IngestionStatus; loading: boolean; onStart: () => void; pending: boolean; countdown: number; running: boolean }) {
  const progress = ingestion && ingestion.total ? Math.min(100, Math.round((ingestion.completed / ingestion.total) * 100)) : 0;
  return (
    <section className="scanline rounded-lg border border-[#364150] bg-[#1d2632] p-5 text-slate-200 shadow-[0_12px_32px_hsl(222_31%_17%_/_0.12)]">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[.18em] text-[#a9b6c5]">Ingestion worker</p>
          <h2 className="mt-1 text-lg font-semibold tracking-tight text-white">Historical data pipeline</h2>
        </div>
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 font-mono text-[10px] uppercase tracking-wider ${running ? 'border-emerald-400/30 bg-emerald-400/15 text-emerald-200' : 'border-slate-500/30 bg-slate-500/15 text-slate-300'}`}>
          <span className={`${running ? 'live-pulse' : ''} size-1.5 rounded-full ${running ? 'bg-emerald-300' : 'bg-slate-400'}`} /> {running ? 'running' : 'standby'}
        </span>
      </div>
      {loading ? <div className="mt-6 space-y-3"><div className="h-2 animate-pulse rounded bg-slate-700" /><div className="h-10 animate-pulse rounded bg-slate-700" /></div> : (
        <>
          <div className="mt-6 flex items-end justify-between">
            <div><span className="font-mono text-3xl font-medium text-[#f4c95d]">{progress}%</span><span className="ml-2 text-xs text-[#a9b6c5]">complete</span></div>
            <span className="font-mono text-xs text-[#a9b6c5]">{formatCompact(ingestion?.completed)} / {formatCompact(ingestion?.total)} records</span>
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-700"><div className="h-full rounded-full bg-[#f4c95d] transition-all duration-700" style={{ width: `${progress}%` }} /></div>
          <div className="mt-5 grid grid-cols-3 divide-x divide-slate-700 border-y border-slate-700 py-3">
            <div className="pr-3"><p className="font-mono text-[10px] uppercase text-[#8493a5]">Pending</p><p className="mt-1 font-mono text-sm text-white">{formatCompact(ingestion?.pending)}</p></div>
            <div className="px-3"><p className="font-mono text-[10px] uppercase text-[#8493a5]">Failed</p><p className={`mt-1 font-mono text-sm ${ingestion?.failed ? 'text-rose-300' : 'text-white'}`}>{formatCompact(ingestion?.failed)}</p></div>
            <div className="pl-3"><p className="font-mono text-[10px] uppercase text-[#8493a5]">Last batch</p><p className="mt-1 font-mono text-sm text-white">{formatCompact(ingestion?.lastRecords)}</p></div>
          </div>
          <div className="mt-4 flex items-center justify-between text-[10px] text-[#a9b6c5]">
             <span className="inline-flex items-center gap-1.5"><Clock3 size={12} /> Next run {formatCountdown(countdown)}</span>
            <span>Synced {formatDate(ingestion?.lastSynced)}</span>
          </div>
        </>
      )}
      <button data-testid="button-start-ingestion" onClick={onStart} disabled={pending} className="mt-5 flex w-full items-center justify-center gap-2 rounded-md bg-[#f4c95d] px-3 py-2.5 text-xs font-bold text-[#1d2632] transition-transform hover:-translate-y-px hover:bg-[#f7d77e] disabled:cursor-wait disabled:opacity-60">
         {pending ? <LoaderCircle size={14} className="animate-spin" /> : <Play size={14} fill="currentColor" />} {pending ? 'Checking collector' : running ? 'Worker running' : 'Check collector schedule'}
      </button>
    </section>
  );
}

function OverviewCard({ label, value, detail, icon: Icon, tone = 'default' }: { label: string; value: string; detail: string; icon: typeof Activity; tone?: 'default' | 'positive' | 'negative' }) {
  return (
    <div className="group rounded-lg border border-border bg-card p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-[#b2bdca] hover:shadow-sm">
      <div className="flex items-start justify-between"><span className="font-mono text-[10px] uppercase tracking-[.13em] text-muted-foreground">{label}</span><Icon size={15} className="text-muted-foreground transition-colors group-hover:text-primary" /></div>
      <p className={`mt-3 font-mono text-2xl font-medium tracking-tight ${tone === 'positive' ? 'text-emerald-700' : tone === 'negative' ? 'text-rose-700' : 'text-foreground'}`}>{value}</p>
      <p className="mt-1 text-[11px] text-muted-foreground">{detail}</p>
    </div>
  );
}

function AppHeader({ asOf, health, onRefresh, refreshing }: { asOf?: string; health?: string; onRefresh: () => void; refreshing: boolean }) {
  return (
    <header className="sticky top-0 z-20 flex min-h-[70px] items-center justify-between border-b border-border bg-background/95 px-5 py-3 backdrop-blur-md md:px-8">
      <div className="flex items-center gap-3">
        <button data-testid="button-mobile-menu" className="rounded-md p-2 text-muted-foreground hover:bg-muted md:hidden"><Menu size={19} /></button>
        <div>
          <div className="flex items-center gap-2"><span className="font-mono text-[10px] uppercase tracking-[.18em] text-muted-foreground">DSE / Market control</span><span className="hidden rounded bg-emerald-100 px-1.5 py-0.5 font-mono text-[9px] font-medium uppercase text-emerald-700 sm:inline-flex">Live</span></div>
          <h1 className="mt-0.5 text-xl font-semibold tracking-tight">Market dashboard</h1>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="hidden text-right sm:block"><p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">As of</p><p className="font-mono text-xs text-foreground">{formatDate(asOf)}</p></div>
        <div className="hidden h-7 w-px bg-border sm:block" />
        <div className="hidden items-center gap-1.5 text-[11px] text-muted-foreground lg:flex"><span className="size-1.5 rounded-full bg-emerald-500" /> API {health || 'checking'}</div>
        <button data-testid="button-refresh-all" onClick={onRefresh} className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-xs font-semibold transition-colors hover:border-primary hover:bg-muted"><RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} /> <span className="hidden sm:inline">Refresh</span></button>
      </div>
    </header>
  );
}

function StockTable({ stocks, loading, error, onRetry, selectedSymbol, onSelect }: { stocks: MarketStock[] | undefined; loading: boolean; error: boolean; onRetry: () => void; selectedSymbol: string; onSelect: (symbol: string) => void }) {
  if (loading) return <div className="space-y-2 p-4">{Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-12 w-full" />)}</div>;
  if (error) return <ErrorState onRetry={onRetry} />;
  if (!stocks?.length) return <EmptyState compact title="No stocks match" detail="Try clearing the search or sector filter." />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse text-left">
        <thead><tr className="border-b border-border bg-muted/60 font-mono text-[9px] uppercase tracking-[.13em] text-muted-foreground"><th className="px-4 py-3 font-medium">Symbol</th><th className="px-3 py-3 font-medium">Sector</th><th className="px-3 py-3 text-right font-medium">LTP</th><th className="px-3 py-3 text-right font-medium">Change</th><th className="px-3 py-3 text-right font-medium">High</th><th className="px-3 py-3 text-right font-medium">Low</th><th className="px-4 py-3 text-right font-medium">Volume</th></tr></thead>
        <tbody>{stocks.map((stock) => {
          const selected = stock.symbol === selectedSymbol;
          return <tr key={stock.symbol} data-testid={`row-stock-${stock.symbol}`} onClick={() => onSelect(stock.symbol)} className={`cursor-pointer border-b border-border/70 transition-colors hover:bg-amber-50/70 ${selected ? 'bg-amber-50/90' : ''}`}>
            <td className="px-4 py-3"><div className="flex items-center gap-2"><span className={`h-5 w-0.5 rounded-full ${selected ? 'bg-[#d39d19]' : 'bg-transparent'}`} /><span className="font-mono text-xs font-medium text-foreground">{stock.symbol}</span></div></td>
            <td className="px-3 py-3 text-xs text-muted-foreground">{stock.sector}</td>
            <td className="px-3 py-3 text-right font-mono text-xs font-medium tabular-nums">{formatNumber(stock.ltp)}</td>
            <td className="px-3 py-3 text-right text-xs"><ToneValue value={stock.change} /></td>
            <td className="px-3 py-3 text-right font-mono text-xs tabular-nums text-muted-foreground">{formatNumber(stock.high)}</td>
            <td className="px-3 py-3 text-right font-mono text-xs tabular-nums text-muted-foreground">{formatNumber(stock.low)}</td>
            <td className="px-4 py-3 text-right font-mono text-xs tabular-nums text-muted-foreground">{formatCompact(stock.volume)}</td>
          </tr>;
        })}</tbody>
      </table>
    </div>
  );
}

export default function MarketDashboard() {
  const queryClient = useQueryClient();
  const [selectedSymbol, setSelectedSymbol] = useState('DSEX');
  const [search, setSearch] = useState('');
  const [sector, setSector] = useState('all');
  const [chartMode, setChartMode] = useState<'line' | 'candles'>('line');
  const [notice, setNotice] = useState('');

  const overviewQuery = useGetMarketOverview({ query: { queryKey: getGetMarketOverviewQueryKey(), refetchInterval: 30000 } });
  const ingestionQuery = useGetIngestionStatus({ query: { queryKey: getGetIngestionStatusQueryKey(), refetchInterval: 15000 } });
  const healthQuery = useHealthCheck({ query: { queryKey: getHealthCheckQueryKey(), refetchInterval: 60000 } });
  const stocksQuery = useGetMarketStocks({ sector: sector === 'all' ? undefined : sector, search: search.trim() || undefined }, { query: { queryKey: getGetMarketStocksQueryKey({ sector: sector === 'all' ? undefined : sector, search: search.trim() || undefined }), refetchInterval: 30000 } });
  const historyQuery = useGetStockHistory(selectedSymbol, { query: { queryKey: getGetStockHistoryQueryKey(selectedSymbol), refetchInterval: 30000, enabled: Boolean(selectedSymbol) } });
  const ingestionMutation = useStartIngestion();

  const overview = overviewQuery.data;
  const stocks = stocksQuery.data;
  const sectors = overview?.sectors || [];
  const selectedStock = stocks?.find((stock) => stock.symbol === selectedSymbol) || overview?.stocks?.find((stock) => stock.symbol === selectedSymbol);
  const history = historyQuery.data;
  const ingestion = ingestionQuery.data || overview?.ingestion;
  const countdown = ingestion?.nextRunAt
    ? Math.max(0, Math.ceil((new Date(ingestion.nextRunAt).getTime() - Date.now()) / 1000))
    : 0;
  const ingestionRunning = Boolean(ingestion?.inProgress) || ingestionMutation.isPending;
  const historyChange = history?.length ? history[history.length - 1].close - history[0].open : 0;
  const historyVolume = history?.reduce((total, point) => total + point.volume, 0) || 0;

  useEffect(() => {
    if (overview?.stocks?.length && !overview.stocks.some((stock) => stock.symbol === selectedSymbol)) setSelectedSymbol(overview.stocks[0].symbol);
  }, [overview, selectedSymbol]);

  const sectorCounts = useMemo(() => {
    const counts = new Map<string, number>();
    (overview?.stocks || []).forEach((stock) => counts.set(stock.sector, (counts.get(stock.sector) || 0) + 1));
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [overview?.stocks]);

  const refreshAll = () => {
    void Promise.all([overviewQuery.refetch(), ingestionQuery.refetch(), healthQuery.refetch(), stocksQuery.refetch(), historyQuery.refetch()]);
  };

  const startIngestion = () => {
    setNotice('');
    ingestionMutation.mutate(undefined, {
      onSuccess: (result) => {
        setNotice(result.message || 'Ingestion worker accepted.');
        void queryClient.invalidateQueries({ queryKey: getGetIngestionStatusQueryKey() });
      },
      onError: () => setNotice('Unable to start the ingestion worker. Try again.'),
    });
  };

  return (
    <div className="flex min-h-[100dvh] bg-background text-foreground">
      <Sidebar active="overview" />
      <div className="min-w-0 flex-1">
        <AppHeader asOf={overview?.asOf} health={healthQuery.data?.status} onRefresh={refreshAll} refreshing={overviewQuery.isFetching || ingestionQuery.isFetching} />
        <main className="terminal-grid min-h-[calc(100dvh-70px)] px-4 py-5 md:px-8 md:py-7">
          <div className="mx-auto max-w-[1480px]">
            <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <div><p className="font-mono text-[10px] uppercase tracking-[.18em] text-muted-foreground">Dhaka Stock Exchange / Daily close</p><h2 className="mt-1 text-2xl font-semibold tracking-tight md:text-3xl">Market pulse</h2><p className="mt-1 text-sm text-muted-foreground">A clear read on the tape, the feed, and what needs attention.</p></div>
              <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground"><span className="live-pulse size-2 rounded-full bg-emerald-500" /> Auto-refresh 30s</div>
            </div>
            {notice && <div data-testid="status-ingestion-notice" className={`mb-4 flex items-center justify-between rounded-md border px-3 py-2 text-xs ${notice.includes('Unable') ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}><span className="inline-flex items-center gap-2">{notice.includes('Unable') ? <X size={14} /> : <Check size={14} />}{notice}</span><button data-testid="button-dismiss-notice" onClick={() => setNotice('')}><X size={14} /></button></div>}
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {overviewQuery.isLoading ? Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-[122px]" />) : <>
                <OverviewCard label="Market" value={overview?.market || 'DSEX'} detail={`Snapshot ${formatDate(overview?.asOf)}`} icon={TrendingUp} tone="positive" />
                <OverviewCard label="Listed universe" value={formatCompact(overview?.stocks?.length)} detail={`${overview?.sectors?.length || 0} tracked sectors`} icon={BarChart3} />
                <OverviewCard label="Advancers" value={formatCompact(overview?.stocks?.filter((stock) => stock.change > 0).length)} detail="Stocks above previous close" icon={ArrowUpRight} tone="positive" />
                <OverviewCard label="Decliners" value={formatCompact(overview?.stocks?.filter((stock) => stock.change < 0).length)} detail="Stocks below previous close" icon={ArrowDownRight} tone="negative" />
              </>}
            </div>

            <section className="mt-5">
              <div className="mb-3 flex items-center justify-between"><div><p className="font-mono text-[10px] uppercase tracking-[.18em] text-muted-foreground">Historical collection</p><h2 className="mt-1 text-sm font-semibold">Backfill progress</h2></div><span className={`font-mono text-[10px] uppercase ${ingestionRunning ? 'text-emerald-700' : 'text-muted-foreground'}`}>{ingestionRunning ? 'Collector working' : `Next cycle ${formatCountdown(countdown)}`}</span></div>
              <div className="grid gap-3 sm:grid-cols-3">
                <OverviewCard label="History coverage" value={`${formatCompact(ingestion?.completed)} / ${formatCompact(ingestion?.total)}`} detail={`${formatCompact(ingestion?.pending)} symbols remaining`} icon={Database} tone="positive" />
                <OverviewCard label="Current task" value={ingestion?.inProgress || 'Waiting'} detail={ingestion?.inProgress ? 'Fetching one-year OHLCV history' : 'Queue is ready for the next cycle'} icon={Activity} />
                <OverviewCard label="Last completed" value={ingestion?.lastSynced || '—'} detail={`${formatCompact(ingestion?.lastRecords)} historical records saved`} icon={Check} tone="positive" />
              </div>
            </section>

            <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
              <section className="rounded-lg border border-border bg-card">
                <div className="flex flex-col gap-3 border-b border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div><div className="flex items-center gap-2"><LineChart size={16} className="text-[#bf8d13]" /><h2 className="text-sm font-semibold">Selected symbol history</h2></div><p className="mt-1 text-xs text-muted-foreground">Daily close and traded volume · {history?.length || 0} observations</p></div>
                   <div className="flex flex-wrap items-center gap-2"><div className="relative"><Search size={13} className="absolute left-2.5 top-2.5 text-muted-foreground" /><input data-testid="input-symbol-search" value={selectedSymbol} onChange={(event) => setSelectedSymbol(event.target.value.toUpperCase())} placeholder="Symbol" className="h-8 w-28 rounded-md border border-border bg-background pl-8 pr-2 font-mono text-xs uppercase outline-none transition-colors focus:border-[#bf8d13] focus:ring-2 focus:ring-[#f4c95d]/30" /></div><span className="rounded bg-muted px-2 py-1 font-mono text-xs font-medium">{selectedSymbol || '—'}</span><div className="flex rounded-md border border-border bg-muted p-0.5"><button type="button" onClick={() => setChartMode('line')} className={`rounded px-2 py-1 font-mono text-[10px] ${chartMode === 'line' ? 'bg-card font-semibold shadow-sm' : 'text-muted-foreground'}`}>Line</button><button type="button" onClick={() => setChartMode('candles')} className={`rounded px-2 py-1 font-mono text-[10px] ${chartMode === 'candles' ? 'bg-card font-semibold shadow-sm' : 'text-muted-foreground'}`}>OHLC</button></div></div>
                </div>
                <div className="px-5 pb-5 pt-4">
                   {historyQuery.isError ? <ErrorState onRetry={() => void historyQuery.refetch()} detail="History could not be loaded for this symbol." /> : <MarketChart points={history} loading={historyQuery.isLoading} mode={chartMode} />}
                  <div className="mt-5 grid grid-cols-2 gap-3 border-t border-border pt-4 sm:grid-cols-4">
                    <div><p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">Last close</p><p className="mt-1 font-mono text-sm">{selectedStock ? formatNumber(selectedStock.ltp) : history?.length ? formatNumber(history[history.length - 1].close) : '—'}</p></div>
                    <div><p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">Period move</p><p className="mt-1 text-sm"><ToneValue value={historyChange} /></p></div>
                    <div><p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">Period high</p><p className="mt-1 font-mono text-sm">{history?.length ? formatNumber(Math.max(...history.map((point) => point.high))) : '—'}</p></div>
                    <div><p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">Total volume</p><p className="mt-1 font-mono text-sm">{formatCompact(historyVolume)}</p></div>
                  </div>
                </div>
              </section>
              <IngestionCard ingestion={ingestion} loading={ingestionQuery.isLoading && !overview?.ingestion} onStart={startIngestion} pending={ingestionMutation.isPending} countdown={countdown} running={ingestionRunning} />
            </div>

            <section className="mt-5 rounded-lg border border-border bg-card">
              <div className="flex flex-col gap-4 border-b border-border px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
                <div><div className="flex items-center gap-2"><Zap size={16} className="text-[#bf8d13]" /><h2 className="text-sm font-semibold">Sector stock browser</h2><span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">{stocks?.length || 0} rows</span></div><p className="mt-1 text-xs text-muted-foreground">Click a symbol to pin its history above.</p></div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <label className="relative"><Search size={13} className="absolute left-2.5 top-2.5 text-muted-foreground" /><input data-testid="input-stock-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search symbols" className="h-8 w-full rounded-md border border-border bg-background pl-8 pr-3 text-xs outline-none transition-colors focus:border-[#bf8d13] sm:w-44" /></label>
                  <label className="relative"><SlidersHorizontal size={13} className="pointer-events-none absolute left-2.5 top-2.5 text-muted-foreground" /><select data-testid="select-sector-filter" value={sector} onChange={(event) => setSector(event.target.value)} className="h-8 w-full appearance-none rounded-md border border-border bg-background pl-8 pr-8 text-xs outline-none transition-colors focus:border-[#bf8d13] sm:w-48"><option value="all">All sectors</option>{sectors.map((item) => <option key={item} value={item}>{item}</option>)}</select><ChevronDown size={13} className="pointer-events-none absolute right-2.5 top-2.5 text-muted-foreground" /></label>
                </div>
              </div>
              <StockTable stocks={stocks} loading={stocksQuery.isLoading} error={Boolean(stocksQuery.isError)} onRetry={() => void stocksQuery.refetch()} selectedSymbol={selectedSymbol} onSelect={setSelectedSymbol} />
              <div className="flex flex-wrap gap-x-5 gap-y-2 border-t border-border bg-muted/30 px-5 py-3">{sectorCounts.slice(0, 5).map(([name, count]) => <span key={name} className="font-mono text-[10px] text-muted-foreground"><span className="mr-1.5 text-foreground">{name}</span>{count}</span>)}{!sectorCounts.length && <span className="font-mono text-[10px] text-muted-foreground">Sector distribution will appear with the next market snapshot.</span>}</div>
            </section>
            <footer className="flex flex-col items-start justify-between gap-2 py-6 text-[10px] text-muted-foreground sm:flex-row sm:items-center"><span className="font-mono uppercase tracking-wider">DSE market control / internal use</span><span className="inline-flex items-center gap-1.5 font-mono"><Download size={12} /> Data refreshes from the ingestion queue</span></footer>
          </div>
        </main>
      </div>
    </div>
  );
}
