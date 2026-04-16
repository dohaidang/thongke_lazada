import type { LazadaOrder } from '../types';

export interface MonthlyStat {
  month: string; // 'YYYY-MM'
  totalSpent: number;
  orderCount: number;
}

export interface TopShop {
  shopName: string;
  totalSpent: number;
  orderCount: number;
}

export interface TopItem {
  itemName: string;
  totalSpent: number;
  quantity: number;
}

export interface StatsResult {
  totalOrders: number;
  validOrders: number;
  totalSpent: number;
  monthlyStats: MonthlyStat[];
  topShops: TopShop[];
  topItems: TopItem[];
}

export function aggregateLazadaStats(orders: LazadaOrder[]): StatsResult {
  // Lazada statuses that indicate the order wasn't fulfilled or money was returned
  // Lowercase for comparison
  const invalidStatuses = [
    'canceled', 'cancelled', 'returned', 'refunded', 
    'đã hủy', 'hủy', 'đã hoàn tiền', 'đóng'
  ];
  
  let totalOrders = 0;
  let validOrders = 0;
  let totalSpent = 0;
  
  const monthlyMap = new Map<string, MonthlyStat>();
  const shopMap = new Map<string, TopShop>();
  const itemMap = new Map<string, TopItem>();

  for (const order of orders) {
    totalOrders++;
    
    // Ignore canceled/refunded orders
    const isInvalid = invalidStatuses.some(s => order.status.toLowerCase().includes(s));
    if (isInvalid) continue;
    
    validOrders++;
    
    // Decide cost. Use finalTotal if available, else sum items or use subtotal fallback.
    let orderCost = order.finalTotal ?? order.subtotal ?? 0;
    
    // Fallback logic if cost is still 0 but there are items
    if (orderCost === 0 && order.items && order.items.length > 0) {
       orderCost = order.items.reduce((sum, item) => sum + ((item.price || 0) * (item.quantity || 1)), 0);
    }
    
    totalSpent += orderCost;
    
    // Group By Month
    let monthKey = 'Unknown';
    if (order.createdAt) {
      // Assuming createdAt is in milliseconds
      const d = new Date(order.createdAt);
      monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    }
    
    let mStat = monthlyMap.get(monthKey);
    if (!mStat) {
      mStat = { month: monthKey, totalSpent: 0, orderCount: 0 };
    }
    mStat.totalSpent += orderCost;
    mStat.orderCount++;
    monthlyMap.set(monthKey, mStat);
    
    // Group By Shop
    const shopName = order.shopName || 'Unknown Shop';
    let sStat = shopMap.get(shopName);
    if (!sStat) {
      sStat = { shopName, totalSpent: 0, orderCount: 0 };
    }
    sStat.totalSpent += orderCost;
    sStat.orderCount++;
    shopMap.set(shopName, sStat);

    // Group By Items
    if (order.items) {
      for (const item of order.items) {
        const itemCost = (item.price || 0) * (item.quantity || 1);
        let iStat = itemMap.get(item.title);
        if (!iStat) {
          iStat = { itemName: item.title, totalSpent: 0, quantity: 0 };
        }
        iStat.totalSpent += itemCost;
        iStat.quantity += (item.quantity || 1);
        itemMap.set(item.title, iStat);
      }
    }
  }

  // Sorting
  const monthlyStats = Array.from(monthlyMap.values()).sort((a, b) => a.month.localeCompare(b.month));
  const topShops = Array.from(shopMap.values()).sort((a, b) => b.totalSpent - a.totalSpent).slice(0, 10);
  const topItems = Array.from(itemMap.values()).sort((a, b) => b.totalSpent - a.totalSpent).slice(0, 50);

  return {
    totalOrders,
    validOrders,
    totalSpent,
    monthlyStats,
    topShops,
    topItems
  };
}
