import { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Activity, ShoppingBag, CreditCard, RefreshCw, AlertCircle } from 'lucide-react';
import { dbService } from './background/db';
import { LazadaOrder } from './types';

// Utils
const formatCurrency = (val: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);

export default function App() {
  const [scanState, setScanState] = useState<any>(null);
  const [stats, setStats] = useState({
    totalSpent: 0,
    totalOrders: 0,
    chartData: [] as any[],
    topShop: ''
  });

  // Calculate stats from orders
  const calculateStats = (orders: LazadaOrder[]) => {
    let totalSpent = 0;
    const monthMap = new Map<string, number>();
    const shopMap = new Map<string, number>();

    orders.forEach(o => {
      // Bỏ qua đơn huỷ/hoàn
      if (['Canceled', 'Returned', 'Refunded', 'Đã hủy', 'Trả hàng/Hoàn tiền'].includes(o.status)) return;
      
      const orderTotal = o.finalTotal || o.subtotal || o.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      totalSpent += orderTotal;

      if (o.createdAt) {
        const date = new Date(o.createdAt);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        monthMap.set(monthKey, (monthMap.get(monthKey) || 0) + orderTotal);
      }

      shopMap.set(o.shopName, (shopMap.get(o.shopName) || 0) + orderTotal);
    });

    const chartData = Array.from(monthMap.entries())
      .map(([month, amount]) => ({ month, amount }))
      .sort((a, b) => a.month.localeCompare(b.month));

    let topShop = '';
    let maxShopStr = 0;
    shopMap.forEach((val, key) => {
      if (val > maxShopStr) {
        maxShopStr = val;
        topShop = key;
      }
    });

    setStats({ totalSpent, totalOrders: orders.length, chartData, topShop });
  };

  const loadData = async () => {
    try {
      const orders = await dbService.getAllOrders();
      calculateStats(orders);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadData();
    // Poll scan state
    const timer = setInterval(() => {
      chrome.runtime.sendMessage({ type: 'GET_SCAN_STATE' }, (resp) => {
        if (resp) setScanState(resp);
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleStartScan = () => {
    chrome.runtime.sendMessage({ type: 'START_SCAN', selectedTabs: ['all', 'Completed', 'To Pay'] }, (resp) => {
      console.log('Started', resp);
    });
  };

  const handleStopScan = () => {
    chrome.runtime.sendMessage({ type: 'ABORT_SCAN' });
  };

  return (
    <div className="w-[400px] h-[550px] bg-[#0f172a] text-slate-200 p-5 flex flex-col font-sans overflow-y-auto relative selection:bg-indigo-500/30">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Activity className="text-white w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Lazada Stats</h1>
            <p className="text-xs text-slate-400 font-medium">Spending Analytics</p>
          </div>
        </div>
        
        {scanState?.active ? (
          <button onClick={handleStopScan} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:text-red-300 rounded-full text-xs font-semibold transition-colors border border-red-500/20">
            <AlertCircle className="w-3.5 h-3.5" /> Stop
          </button>
        ) : (
          <button onClick={handleStartScan} className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-500 hover:bg-indigo-400 text-white rounded-full text-xs font-semibold transition-colors shadow-md shadow-indigo-500/20">
            <RefreshCw className="w-3.5 h-3.5" /> Sync Data
          </button>
        )}
      </div>

      {/* Main KPI */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700/50 p-5 mb-5 shadow-xl group">
        <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 rounded-full bg-indigo-500/10 blur-2xl transition-all group-hover:bg-indigo-500/20"></div>
        <p className="text-sm text-slate-400 font-medium mb-1">Total Valid Spend (All time)</p>
        <h2 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-400 tracking-tight">
          {formatCurrency(stats.totalSpent)}
        </h2>
        <div className="flex items-center gap-4 mt-4">
          <div className="flex items-center gap-1.5">
            <ShoppingBag className="w-4 h-4 text-emerald-400" />
            <span className="text-sm font-medium">{stats.totalOrders} total orders</span>
          </div>
        </div>
      </div>

      {/* Mini Stats Grid */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-3 flex flex-col justify-center">
          <div className="flex items-center gap-2 mb-1">
            <CreditCard className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">Top Shop</span>
          </div>
          <p className="text-sm font-semibold truncate text-white" title={stats.topShop}>{stats.topShop || '--'}</p>
        </div>
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-3 flex flex-col justify-center">
          <div className="flex items-center gap-2 mb-1">
            <Activity className="w-3.5 h-3.5 text-pink-400" />
            <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">Avg/Order</span>
          </div>
          <p className="text-sm font-semibold text-white">
            {stats.totalOrders > 0 ? formatCurrency(stats.totalSpent / stats.totalOrders) : '--'}
          </p>
        </div>
      </div>

      {/* Chart Section */}
      <div className="mt-auto bg-slate-800/30 rounded-2xl p-4 border border-slate-700/50">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center justify-between mb-4">
          Spending Timeline
          <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
        </h3>
        <div className="h-32 w-full">
          {stats.chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.chartData}>
                <defs>
                  <linearGradient id="colorSpend" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="month" hide />
                <YAxis hide />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                  itemStyle={{ color: '#e2e8f0', fontWeight: 'bold' }}
                  formatter={(val: number) => formatCurrency(val)}
                />
                <Area type="monotone" dataKey="amount" stroke="#818cf8" strokeWidth={2} fillOpacity={1} fill="url(#colorSpend)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-slate-500 text-xs text-center px-4">
              Not enough data to plot chart. Click Sync Data.
            </div>
          )}
        </div>
      </div>

      {/* Scanning Overlay (Subtle) */}
      {scanState?.active && (
        <div className="absolute inset-x-0 bottom-0 p-3">
          <div className="bg-slate-800/90 backdrop-blur-md border border-indigo-500/30 p-3 rounded-xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-bottom-2">
            <RefreshCw className="w-4 h-4 text-indigo-400 animate-spin" />
            <div className="flex-1">
              <div className="text-xs text-slate-300 font-medium">Scanning Lazada ({scanState.progress?.tab})</div>
              <div className="w-full bg-slate-700 h-1.5 rounded-full mt-1.5 overflow-hidden relative">
                <div className="absolute top-0 left-0 h-full bg-gradient-to-r from-indigo-500 to-cyan-400 w-1/3 animate-pulse" />
              </div>
            </div>
            <div className="text-[10px] tabular-nums font-mono text-indigo-300 bg-indigo-500/10 px-2 py-1 rounded">
              +{scanState.progress?.inserted}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
