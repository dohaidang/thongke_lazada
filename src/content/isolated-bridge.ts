// Isolated-world bridge: forwards background → main-world (page) via window.postMessage.
// Main-world logic lives in `main-world.ts` and is loaded as a separate MV3 content script with world: "MAIN".
console.log('[lazada-stats] isolated bridge injected');

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

  return true;
});

window.addEventListener('message', (event) => {
  if (event.source !== window) return;
  if (event.data?.type === 'LAZADA_MAIN_WORLD_READY') {
    console.log('[lazada-stats] main-world ready');
  }
});
