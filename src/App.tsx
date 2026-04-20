import { useState, useEffect, useRef, useCallback } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import {
  Activity,
  ShoppingBag,
  Store,
  RefreshCw,
  AlertCircle,
  Sparkles,
  TrendingUp,
  BarChart3,
  CircleStop,
  RotateCcw,
} from 'lucide-react';
import { dbService } from './background/db';
import { aggregateLazadaStats, type StatsResult } from './utils/statsEngine';

const formatCurrency = (val: number) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(val);

type ScanProgress = {
  tab: string;
  page: number;
  fetched: number;
  inserted: number;
  totalInserted: number;
};

type ScanState =
  | { active: false; progress: null; error: null }
  | { active: true; progress: ScanProgress; error: null }
  | { active: false; progress: null; error: { message: string } };

function shortMonthLabel(month: string) {
  const parts = month.split('-');
  if (parts.length >= 2) {
    const m = Number(parts[1]);
    const labels = ['', 'T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T11', 'T12'];
    if (m >= 1 && m <= 12) return `${labels[m]} '${String(parts[0]).slice(2)}`;
  }
  return month;
}

export default function App() {
  const [scanState, setScanState] = useState<ScanState | null>(null);
  const [stats, setStats] = useState<StatsResult>({
    totalOrders: 0,
    validOrders: 0,
    totalSpent: 0,
    monthlyStats: [],
    topShops: [],
    topItems: [],
  });
  const [loading, setLoading] = useState(true);
  const prevScanActive = useRef(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const orders = await dbService.getAllOrders();
      setStats(aggregateLazadaStats(orders));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
    const timer = setInterval(() => {
      chrome.runtime.sendMessage({ type: 'GET_SCAN_STATE' }, (resp: unknown) => {
        if (resp) setScanState(resp as ScanState);
      });
    }, 800);
    return () => clearInterval(timer);
  }, [loadData]);

  useEffect(() => {
    if (!scanState) return;
    if (prevScanActive.current && !scanState.active && !scanState.error) {
      void loadData();
    }
    prevScanActive.current = scanState.active;
  }, [scanState, loadData]);

  const handleStartScan = () => {
    chrome.runtime.sendMessage({ type: 'START_SCAN', selectedTabs: ['all', 'Completed', 'To Pay'] }, () => undefined);
  };

  const handleStopScan = () => {
    chrome.runtime.sendMessage({ type: 'ABORT_SCAN' });
  };

  const chartData = stats.monthlyStats.map((m) => ({
    month: m.month,
    label: shortMonthLabel(m.month),
    totalSpent: m.totalSpent,
    orderCount: m.orderCount,
  }));

  const topShop = stats.topShops[0]?.shopName ?? '';
  const avgPerOrder = stats.validOrders > 0 ? stats.totalSpent / stats.validOrders : 0;
  const topItems3 = stats.topItems.slice(0, 3);
  const maxItemSpend = Math.max(1, ...topItems3.map((i) => i.totalSpent));

  const scanErr = scanState && !scanState.active ? scanState.error : null;

  return (
    <div className="w-[420px] min-h-[580px] max-h-[640px] text-slate-100 flex flex-col overflow-hidden selection:bg-amber-500/25">
      {/* Top bar */}
      <header className="shrink-0 px-5 pt-5 pb-3 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative shrink-0">
            <div className="absolute inset-0 rounded-2xl bg-amber-500/25 blur-xl scale-110" aria-hidden />
            <div className="relative w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 via-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-900/40 ring-1 ring-white/10">
              <BarChart3 className="w-6 h-6 text-slate-950" strokeWidth={2.25} />
            </div>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold tracking-tight text-white truncate">Thống kê Lazada</h1>
              <span className="hidden sm:inline-flex items-center rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400 ring-1 ring-white/10">
                Local
              </span>
            </div>
            <p className="text-xs text-slate-400 font-medium">Chi tiêu &amp; đơn hàng đã lưu</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => void loadData()}
            disabled={loading}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 text-slate-300 ring-1 ring-white/10 hover:bg-white/10 hover:text-white transition-colors disabled:opacity-50"
            title="Làm mới số liệu"
          >
            <RotateCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          {scanState?.active ? (
            <button
              type="button"
              onClick={handleStopScan}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-red-500/15 px-3 text-xs font-semibold text-red-300 ring-1 ring-red-400/25 hover:bg-red-500/25 transition-colors"
            >
              <CircleStop className="w-3.5 h-3.5" />
              Dừng
            </button>
          ) : (
            <button
              type="button"
              onClick={handleStartScan}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-3.5 text-xs font-bold text-slate-950 shadow-md shadow-amber-900/30 hover:brightness-105 transition-all"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Đồng bộ
            </button>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-5 pb-28 space-y-4 [scrollbar-width:thin]">
        {scanErr && (
          <div
            className="rounded-2xl border border-red-400/25 bg-red-500/10 px-4 py-3 flex gap-3 items-start"
            role="alert"
          >
            <AlertCircle className="w-4 h-4 text-red-300 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-red-200">Không đồng bộ được</p>
              <p className="text-[11px] text-red-200/80 leading-snug mt-0.5 break-words">{scanErr.message}</p>
            </div>
          </div>
        )}

        {/* Hero KPI */}
        <section className="relative overflow-hidden rounded-3xl p-[1px] bg-gradient-to-br from-white/14 via-white/5 to-transparent">
          <div className="rounded-[calc(1.5rem-1px)] bg-[rgba(12,14,22,0.88)] backdrop-blur-xl p-5 ring-1 ring-white/10">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Tổng chi hợp lệ</p>
                <p className="mt-2 text-3xl sm:text-4xl font-extrabold tracking-tight text-white font-mono-nums">
                  {loading ? '…' : formatCurrency(stats.totalSpent)}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-300 ring-1 ring-emerald-400/20">
                  <TrendingUp className="w-3.5 h-3.5" />
                  {stats.validOrders > 0 ? 'Có dữ liệu' : 'Trống'}
                </span>
                <span className="text-[10px] text-slate-500">theo đơn đã lưu</span>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-xl bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-200 ring-1 ring-white/10">
                <ShoppingBag className="w-3.5 h-3.5 text-teal-300" />
                {stats.validOrders}/{stats.totalOrders} đơn hợp lệ
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-xl bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-300 ring-1 ring-white/10">
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                Dashboard cá nhân
              </span>
            </div>
          </div>
        </section>

        {/* Bento metrics */}
        <section className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-white/[0.04] p-4 ring-1 ring-white/10 backdrop-blur-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Shop yêu thích</span>
              <Store className="w-4 h-4 text-amber-400/90" />
            </div>
            <p className="mt-2 text-sm font-semibold text-white leading-snug line-clamp-2 min-h-[2.5rem]" title={topShop}>
              {topShop || '—'}
            </p>
            <p className="mt-1 text-[10px] text-slate-500">Theo tổng chi</p>
          </div>

          <div className="rounded-2xl bg-white/[0.04] p-4 ring-1 ring-white/10 backdrop-blur-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">TB / đơn</span>
              <Activity className="w-4 h-4 text-teal-300/90" />
            </div>
            <p className="mt-2 text-sm font-semibold text-white font-mono-nums">
              {stats.validOrders > 0 ? formatCurrency(avgPerOrder) : '—'}
            </p>
            <p className="mt-1 text-[10px] text-slate-500">Chỉ tính đơn hợp lệ</p>
          </div>
        </section>

        {/* Top items */}
        <section className="rounded-3xl bg-white/[0.03] p-4 ring-1 ring-white/10">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              Top sản phẩm
            </h2>
            <span className="text-[10px] text-slate-500">theo tổng tiền</span>
          </div>

          {topItems3.length > 0 ? (
            <ul className="space-y-2.5">
              {topItems3.map((it, idx) => {
                const rank = idx + 1;
                const pct = Math.round((it.totalSpent / maxItemSpend) * 100);
                const ring =
                  rank === 1
                    ? 'from-amber-400/35 to-orange-500/15'
                    : rank === 2
                      ? 'from-slate-300/25 to-slate-500/10'
                      : 'from-amber-900/35 to-slate-800/20';
                return (
                  <li key={`${it.itemName}-${idx}`}>
                    <div
                      className={`rounded-2xl p-[1px] bg-gradient-to-br ${ring}`}
                      title={it.itemName}
                    >
                      <div className="rounded-[calc(1rem-1px)] bg-[rgba(8,10,16,0.65)] px-3 py-2.5">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-2.5 min-w-0">
                            <span
                              className={`mt-0.5 inline-flex h-6 min-w-6 items-center justify-center rounded-lg text-[11px] font-extrabold font-mono-nums ${
                                rank === 1
                                  ? 'bg-amber-500/20 text-amber-200'
                                  : rank === 2
                                    ? 'bg-slate-500/20 text-slate-200'
                                    : 'bg-orange-950/40 text-orange-200'
                              }`}
                            >
                              {rank}
                            </span>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-white leading-snug line-clamp-2">{it.itemName}</p>
                              <p className="text-[11px] text-slate-500 mt-0.5">
                                SL {it.quantity} · {formatCurrency(it.totalSpent)}
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="mt-2 h-1.5 rounded-full bg-white/5 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-teal-400/80 to-amber-400/80"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 px-4 py-6 text-center">
              <p className="text-sm text-slate-400">Chưa có mặt hàng để xếp hạng</p>
              <p className="text-xs text-slate-500 mt-1">Mở tab Lazada và bấm Đồng bộ</p>
            </div>
          )}
        </section>

        {/* Chart */}
        <section className="rounded-3xl bg-white/[0.03] p-4 ring-1 ring-white/10 pb-5">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <Activity className="w-3.5 h-3.5 text-teal-300" />
              Dòng chi tiêu
            </h2>
            <span className="text-[10px] text-slate-500">theo tháng</span>
          </div>

          <div className="h-44 w-full">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 6, right: 4, left: -18, bottom: 0 }}>
                  <defs>
                    <linearGradient id="spendFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 6" vertical={false} stroke="rgba(148,163,184,0.12)" />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: '#94a3b8', fontSize: 10 }}
                    tickLine={false}
                    axisLine={{ stroke: 'rgba(148,163,184,0.15)' }}
                    interval="preserveStartEnd"
                  />
                  <YAxis hide domain={['dataMin', 'dataMax']} />
                  <Tooltip
                    cursor={{ stroke: 'rgba(245,158,11,0.35)', strokeWidth: 1 }}
                    contentStyle={{
                      backgroundColor: 'rgba(10,12,18,0.92)',
                      border: '1px solid rgba(148,163,184,0.18)',
                      borderRadius: 14,
                      boxShadow: '0 18px 50px rgba(0,0,0,0.55)',
                      padding: '10px 12px',
                    }}
                    labelStyle={{ color: '#cbd5e1', fontWeight: 700, fontSize: 11, marginBottom: 4 }}
                    formatter={(val) => {
                      const num = typeof val === 'number' ? val : 0;
                      return [formatCurrency(num), 'Chi tiêu'];
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="totalSpent"
                    stroke="#fbbf24"
                    strokeWidth={2.25}
                    fillOpacity={1}
                    fill="url(#spendFill)"
                    dot={false}
                    activeDot={{ r: 4, strokeWidth: 0, fill: '#fde68a' }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center px-6 rounded-2xl border border-dashed border-white/10 bg-black/15">
                <p className="text-sm text-slate-400">Chưa đủ dữ liệu để vẽ biểu đồ</p>
                <p className="text-xs text-slate-500 mt-1">Đồng bộ đơn hàng để xem xu hướng theo tháng</p>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Scanning dock */}
      {scanState?.active && (
        <div className="fixed bottom-0 left-0 right-0 p-4 pointer-events-none">
          <div className="pointer-events-auto mx-auto max-w-[420px] rounded-2xl border border-amber-400/20 bg-[rgba(8,10,16,0.92)] backdrop-blur-xl shadow-2xl shadow-black/50 p-3 flex items-center gap-3">
            <div className="relative">
              <div className="absolute inset-0 rounded-xl bg-amber-500/20 blur-md" />
              <div className="relative h-10 w-10 rounded-xl bg-amber-500/15 ring-1 ring-amber-400/25 flex items-center justify-center">
                <RefreshCw className="w-5 h-5 text-amber-300 animate-spin" />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-slate-100 truncate">Đang quét Lazada</p>
                <span className="text-[10px] font-mono-nums text-amber-200/90 bg-amber-500/10 px-2 py-0.5 rounded-md ring-1 ring-amber-400/20">
                  +{scanState.progress?.totalInserted ?? 0}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                Tab: <span className="text-slate-200 font-medium">{scanState.progress?.tab}</span> · Trang{' '}
                {scanState.progress?.page ?? 0} · Lần này +{scanState.progress?.inserted ?? 0} đơn
              </p>
              <div className="mt-2 h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div className="h-full w-2/5 rounded-full animate-shimmer-bar" />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
