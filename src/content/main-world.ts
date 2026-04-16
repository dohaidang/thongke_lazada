// Main world script (Bypass CORS) — runs in Lazada page context.
// Implements POST (form GraphQL) to:
//   https://my.lazada.vn/customer/api/async/order-list
//
// Receives requests via window.postMessage and responds via window.postMessage.
console.log('[lazada-stats] main-world initialized');

type OrderListRequest = {
  type: 'LAZADA_ORDER_LIST_REQUEST';
  requestId: string;
  variables?: Record<string, unknown>;
  // Some Lazada endpoints accept `query` (GraphQL), others accept persisted query/operationName.
  query?: string;
  operationName?: string;
  // Any additional form fields if needed.
  extraForm?: Record<string, string>;
};

type OrderListResponse = {
  type: 'LAZADA_ORDER_LIST_RESPONSE';
  requestId: string;
  ok: boolean;
  status?: number;
  data?: unknown;
  error?: string;
  errorCode?: 'AUTH' | 'RATE_LIMIT' | 'NETWORK' | 'BAD_REQUEST';
};

const ORDER_LIST_URL = 'https://my.lazada.vn/customer/api/async/order-list';

function getCsrfToken(): string | null {
  // 1) meta tag
  const meta = document.querySelector('meta[name="csrf-token"], meta[name="x-csrf-token"]') as HTMLMetaElement | null;
  if (meta?.content) return meta.content;

  // 2) cookie
  const cookieMatch = document.cookie.match(/(?:^|;\s*)(x-csrf-token|csrf_token|csrfToken|XSRF-TOKEN)=([^;]+)/i);
  if (cookieMatch?.[2]) {
    try {
      return decodeURIComponent(cookieMatch[2]);
    } catch {
      return cookieMatch[2];
    }
  }

  // 3) localStorage (best-effort)
  try {
    const ls =
      window.localStorage.getItem('x-csrf-token') ??
      window.localStorage.getItem('csrf-token') ??
      window.localStorage.getItem('csrfToken');
    if (ls) return ls;
  } catch {
    // ignore
  }

  return null;
}

function cleanResponse(raw: unknown): unknown {
  // Keep it conservative: remove huge blobs, functions, DOM, etc.
  // Most responses are JSON already; we pass through but ensure it's serializable.
  try {
    return JSON.parse(JSON.stringify(raw));
  } catch {
    return null;
  }
}

async function fetchOrderList(req: OrderListRequest): Promise<OrderListResponse> {
  try {
    const csrf = getCsrfToken();

    const form = new URLSearchParams();
    if (req.query) form.set('query', req.query);
    if (req.operationName) form.set('operationName', req.operationName);
    if (req.variables) form.set('variables', JSON.stringify(req.variables));
    if (req.extraForm) {
      for (const [k, v] of Object.entries(req.extraForm)) form.set(k, v);
    }

    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'x-requested-with': 'XMLHttpRequest',
      ...(csrf ? { 'x-csrf-token': csrf } : {}),
    };

    const res = await fetch(ORDER_LIST_URL, {
      method: 'POST',
      headers,
      credentials: 'include',
      body: form.toString(),
    });

    if (res.status === 401 || res.status === 403) {
      res.body?.cancel();
      return { type: 'LAZADA_ORDER_LIST_RESPONSE', requestId: req.requestId, ok: false, status: res.status, errorCode: 'AUTH', error: 'Session expired' };
    }
    if (res.status === 429) {
      res.body?.cancel();
      return { type: 'LAZADA_ORDER_LIST_RESPONSE', requestId: req.requestId, ok: false, status: res.status, errorCode: 'RATE_LIMIT', error: 'Rate limited' };
    }

    const json = await res.json().catch(() => null);
    return {
      type: 'LAZADA_ORDER_LIST_RESPONSE',
      requestId: req.requestId,
      ok: true,
      status: res.status,
      data: cleanResponse(json),
    };
  } catch (e) {
    return {
      type: 'LAZADA_ORDER_LIST_RESPONSE',
      requestId: req.requestId,
      ok: false,
      errorCode: 'NETWORK',
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

window.addEventListener('message', async (event: MessageEvent) => {
  if (event.source !== window) return;
  const msg = event.data as Partial<OrderListRequest> | undefined;
  if (!msg || msg.type !== 'LAZADA_ORDER_LIST_REQUEST') return;
  if (!msg.requestId) return;

  const resp = await fetchOrderList(msg as OrderListRequest);
  window.postMessage(resp, '*');
});

// Optional: notify content-script that main-world is ready.
window.postMessage({ type: 'LAZADA_MAIN_WORLD_READY' }, '*');
