// Service Worker Background Script
import type { LazadaOrder, ScanCheckpoint } from '../types';
import { dbService } from './db';

console.log('[lazada-stats] background worker loaded');

type StartScanMessage = {
  type: 'START_SCAN';
  selectedTabs?: string[]; // order status tabs
};

type AbortScanMessage = {
  type: 'ABORT_SCAN';
};

type ScanStateMessage = {
  type: 'GET_SCAN_STATE';
};

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

type LazadaOrderListRequest = {
  type: 'LAZADA_ORDER_LIST_REQUEST';
  requestId: string;
  variables?: Record<string, unknown>;
  query?: string;
  operationName?: string;
  extraForm?: Record<string, string>;
};

type LazadaOrderListResponse = {
  type: 'LAZADA_ORDER_LIST_RESPONSE';
  requestId: string;
  ok: boolean;
  status?: number;
  data?: unknown;
  error?: string;
  errorCode?: string;
};

const PAGE_LIMIT = 20;
const MIN_DELAY_MS = 1000;
const MAX_DELAY_MS = 2000;

let currentAbort: AbortController | null = null;
let state: ScanState = { active: false, progress: null, error: null };

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function randDelayMs() {
  return Math.floor(MIN_DELAY_MS + Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS + 1));
}

async function getActiveLazadaTabId(): Promise<number | null> {
  const tabs = await chrome.tabs.query({ url: ['*://*.lazada.vn/*', '*://my.lazada.vn/*'] });
  const active = tabs.find((t) => t.active && t.id != null) ?? tabs.find((t) => t.id != null);
  return active?.id ?? null;
}

async function requestOrderList(tabId: number, payload: Omit<LazadaOrderListRequest, 'type' | 'requestId'>): Promise<LazadaOrderListResponse> {
  const requestId = crypto.randomUUID();
  const msg: LazadaOrderListRequest = { type: 'LAZADA_ORDER_LIST_REQUEST', requestId, ...payload };
  const resp = (await chrome.tabs.sendMessage(tabId, msg)) as LazadaOrderListResponse;
  return resp;
}

function extractOrders(raw: unknown, fallbackStatus: string): LazadaOrder[] {
  if (!raw || typeof raw !== 'object') return [];

  let dataNode: any = null;
  const visit = (node: unknown) => {
    if (!node || typeof node !== 'object') return;
    if (dataNode) return;

    const keys = Object.keys(node as Record<string, unknown>);
    if (keys.some((k) => k.startsWith('order_')) && keys.some((k) => k.startsWith('orderItem_'))) {
      dataNode = node;
      return;
    }
    for (const v of Object.values(node as Record<string, unknown>)) visit(v);
  };

  visit(raw);

  if (!dataNode) {
    return [];
  }

  const ordersMap = new Map<string, LazadaOrder>();
  const itemsMap = new Map<string, any[]>();
  const shopMap = new Map<string, any>();

  Object.entries(dataNode).forEach(([key, value]: [string, any]) => {
    const fields = value?.fields || value;
    if (!fields) return;

    const rawId = fields.tradeOrderId ?? fields.orderId ?? fields.order_id ?? fields.id;
    if (!rawId) return;
    const orderId = String(rawId);

    if (key.startsWith('order_')) {
      if (!ordersMap.has(orderId)) {
        ordersMap.set(orderId, {
          orderId,
          shopName: 'Unknown',
          status: fields.status || fallbackStatus,
          subtotal: typeof fields.subTotal === 'number' ? fields.subTotal : undefined,
          finalTotal:
            typeof fields.total === 'number'
              ? fields.total
              : typeof fields.price === 'number'
                ? fields.price
                : undefined,
          createdAt: typeof fields.createTime === 'number' ? fields.createTime : undefined,
          items: [],
        });
      } else {
        const existing = ordersMap.get(orderId)!;
        existing.status = fields.status || existing.status;
      }
    } else if (key.startsWith('orderShop_')) {
      shopMap.set(orderId, fields);
    } else if (key.startsWith('orderItem_')) {
      if (!itemsMap.has(orderId)) itemsMap.set(orderId, []);
      itemsMap.get(orderId)!.push(fields);
    }
  });

  const results: LazadaOrder[] = [];
  ordersMap.forEach((order, orderId) => {
    const shop = shopMap.get(orderId);
    if (shop) {
      order.shopName = shop.name || shop.sellerName || order.shopName;
      order.status = shop.status || order.status;
    }

    const items = itemsMap.get(orderId) || [];
    order.items = items.map((item: any) => ({
      itemId: String(item.itemId || item.id || ''),
      title: String(item.title || item.name || ''),
      price:
        (typeof item.itemPrice !== 'undefined'
          ? Number(item.itemPrice)
          : typeof item.price === 'string'
            ? Number(item.price.replace(/[^\d]/g, ''))
            : Number(item.price)) || 0,
      quantity: Number(item.quantity) || 1,
      picUrl: String(item.picUrl || item.image || ''),
      skuText: String(item.sku?.skuText || item.skuText || ''),
      itemStatus: String(item.status || order.status),
    }));

    results.push(order);
  });

  return results;
}

async function runScan(selectedTabs: string[]) {
  if (currentAbort) return;
  currentAbort = new AbortController();
  const signal = currentAbort.signal;

  try {
    const tabId = await getActiveLazadaTabId();
    if (tabId == null) throw new Error('No Lazada tab found. Please open lazada.vn and login.');

    const cachedIds = await dbService.getAllOrderIds();

    const cp = await dbService.getCheckpoint();
    let checkpoint: ScanCheckpoint =
      cp ?? {
        selectedTabs,
        currentTabIndex: 0,
        currentPage: 0,
        savedAt: Date.now(),
        isComplete: false,
      };

    if (checkpoint.selectedTabs.join('|') !== selectedTabs.join('|')) {
      checkpoint = {
        selectedTabs,
        currentTabIndex: 0,
        currentPage: 0,
        savedAt: Date.now(),
        isComplete: false,
      };
    }

    let totalInserted = 0;
    state = {
      active: true,
      progress: {
        tab: selectedTabs[checkpoint.currentTabIndex] ?? selectedTabs[0] ?? 'all',
        page: checkpoint.currentPage,
        fetched: 0,
        inserted: 0,
        totalInserted: 0,
      },
      error: null,
    };

    for (let tabIdx = checkpoint.currentTabIndex; tabIdx < selectedTabs.length; tabIdx++) {
      const tab = selectedTabs[tabIdx];
      let page = tabIdx === checkpoint.currentTabIndex ? checkpoint.currentPage : 0;

      for (;;) {
        if (signal.aborted) throw new Error('aborted');

        const resp = await requestOrderList(tabId, {
          operationName: 'orderList',
          variables: {
            status: tab,
            page,
            limit: PAGE_LIMIT,
          },
        });

        if (!resp.ok) {
          throw new Error(resp.error ?? `API error (${resp.errorCode ?? 'UNKNOWN'})`);
        }

        const orders = extractOrders(resp.data, tab);
        if (orders.length === 0) {
          break;
        }

        const hasDuplicate = orders.some((o) => cachedIds.has(o.orderId));
        const newOrders = hasDuplicate ? orders.filter((o) => !cachedIds.has(o.orderId)) : orders;

        if (newOrders.length > 0) {
          await dbService.putOrderBatch(newOrders);
          for (const o of newOrders) cachedIds.add(o.orderId);
          totalInserted += newOrders.length;
        }

        state = {
          active: true,
          progress: {
            tab,
            page,
            fetched: orders.length,
            inserted: newOrders.length,
            totalInserted,
          },
          error: null,
        };

        checkpoint = {
          selectedTabs,
          currentTabIndex: tabIdx,
          currentPage: page,
          savedAt: Date.now(),
          isComplete: false,
        };
        await dbService.setCheckpoint(checkpoint);

        if (hasDuplicate) {
          break;
        }

        page += 1;
        await sleep(randDelayMs());
      }
    }

    await dbService.setCheckpoint({
      selectedTabs,
      currentTabIndex: selectedTabs.length,
      currentPage: 0,
      savedAt: Date.now(),
      isComplete: true,
    });

    state = { active: false, progress: null, error: null };
  } catch (e) {
    if (String((e as any)?.message ?? e) === 'aborted') {
      state = { active: false, progress: null, error: null };
    } else {
      state = {
        active: false,
        progress: null,
        error: { message: e instanceof Error ? e.message : String(e) },
      };
    }
  } finally {
    currentAbort = null;
  }
}

chrome.runtime.onMessage.addListener(
  (message: unknown, _sender: unknown, sendResponse: (response?: unknown) => void) => {
    const msg = message as StartScanMessage | AbortScanMessage | ScanStateMessage | null;

    if (msg?.type === 'START_SCAN') {
      const selectedTabs = msg.selectedTabs?.length ? msg.selectedTabs : ['all'];
      void runScan(selectedTabs);
      sendResponse({ status: 'started' });
      return;
    }

    if (msg?.type === 'ABORT_SCAN') {
      currentAbort?.abort();
      sendResponse({ status: 'aborted' });
      return;
    }

    if (msg?.type === 'GET_SCAN_STATE') {
      sendResponse(state);
    }
  },
);
