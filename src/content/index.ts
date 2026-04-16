// Content Script: inject main-world + forward its results to extension runtime if needed.
console.log('[lazada-stats] content script injected');

const mainWorldUrl = chrome.runtime.getURL('src/content/main-world.ts');
const script = document.createElement('script');
script.src = mainWorldUrl;
script.type = 'module';
script.dataset.lazadaStatsMainWorld = '1';
(document.head || document.documentElement).appendChild(script);

type LazadaOrderListRequestToMainWorld = {
  type: 'LAZADA_ORDER_LIST_REQUEST';
  requestId: string;
  variables?: Record<string, unknown>;
  query?: string;
  operationName?: string;
  extraForm?: Record<string, string>;
};

type LazadaOrderListResponseFromMainWorld = {
  type: 'LAZADA_ORDER_LIST_RESPONSE';
  requestId: string;
  ok: boolean;
  status?: number;
  data?: unknown;
  error?: string;
  errorCode?: string;
};

// Allow background to request Lazada API via main-world.
chrome.runtime.onMessage.addListener((message: unknown, _sender: unknown, sendResponse: (response?: unknown) => void) => {
  const msg = message as Partial<{ type: string; requestId: string } & LazadaOrderListRequestToMainWorld>;
  if (msg?.type !== 'LAZADA_ORDER_LIST_REQUEST' || !msg.requestId) return;

  const request: LazadaOrderListRequestToMainWorld = {
    type: 'LAZADA_ORDER_LIST_REQUEST',
    requestId: msg.requestId,
    variables: msg.variables,
    query: msg.query,
    operationName: msg.operationName,
    extraForm: msg.extraForm,
  };

  // Wait for matching response from main-world
  const handler = (event: MessageEvent) => {
    if (event.source !== window) return;
    const data = event.data as Partial<LazadaOrderListResponseFromMainWorld>;
    if (data?.type !== 'LAZADA_ORDER_LIST_RESPONSE') return;
    if (data.requestId !== request.requestId) return;
    window.removeEventListener('message', handler);
    sendResponse(data);
  };

  window.addEventListener('message', handler);
  window.postMessage(request, '*');

  // async response
  return true;
});

// Debug log: main-world ready + responses
window.addEventListener('message', (event) => {
  if (event.source !== window) return;
  if (event.data?.type === 'LAZADA_MAIN_WORLD_READY') {
    console.log('[lazada-stats] main-world ready');
  }
});
