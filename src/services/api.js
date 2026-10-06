/**
 * DataPadi API client — talks to the Slim backend.
 * JWT stored in localStorage and attached to every admin request.
 */

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080'

const TOKEN_KEY = 'dp_token'
const ADMIN_KEY = 'dp_admin'

/* ── Token management ───────────────────────────────── */
// Each key is a parameter so the partner console can keep its own session
// (dp_partner_token) without disturbing this one. The defaults are what every
// existing caller already uses, so their behaviour is unchanged.
export function getToken(key = TOKEN_KEY) {
  return localStorage.getItem(key)
}
export function setToken(token, key = TOKEN_KEY) {
  localStorage.setItem(key, token)
}
export function getAdmin(key = ADMIN_KEY) {
  try {
    return JSON.parse(localStorage.getItem(key))
  } catch {
    return null
  }
}
export function setAdmin(admin, key = ADMIN_KEY) {
  localStorage.setItem(key, JSON.stringify(admin))
}
export function clearAuth(tokenKey = TOKEN_KEY, adminKey = ADMIN_KEY) {
  localStorage.removeItem(tokenKey)
  localStorage.removeItem(adminKey)
}
export function isAuthenticated() {
  return !!getToken()
}

/* ── Fetch wrapper ──────────────────────────────────── */
/**
 * Exported so the partner console can share this wrapper — and therefore its
 * error shaping, its 401 handling and its network-failure message — instead of
 * growing a second copy that drifts.
 */
export async function request(method, path, body = null, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers }

  // The partner console authenticates with its own stored token against the same
  // admin API, so which token to send is per-call rather than global.
  const tokenKey = options.tokenKey || TOKEN_KEY
  const adminKey = options.adminKey || ADMIN_KEY

  const token = getToken(tokenKey)
  if (token) headers['Authorization'] = `Bearer ${token}`

  const config = { method, headers }
  if (body && method !== 'GET') config.body = JSON.stringify(body)

  let res
  try {
    res = await fetch(`${API_BASE}${path}`, config)
  } catch {
    throw new Error('Cannot reach the server. Please check your connection.')
  }

  if (res.status === 401 && !options.allow401) {
    // Only the session that just failed is cleared, and only that console is
    // bounced to its own login — an expired partner token must not log the
    // operator out of the main admin console they are working in, and vice
    // versa. Both are separate screens with separate tabs.
    clearAuth(tokenKey, adminKey)
    window.location.hash = options.loginRoute || '#/admin'
    window.location.reload()
    throw new Error('Session expired — please log in again.')
  }

  let data
  try {
    data = await res.json()
  } catch {
    if (res.status === 429) throw new Error('Too many requests. Please wait a moment.')
    throw new Error('Server trouble. Please try again in a moment.')
  }

  if (!res.ok) {
    const detail = data?.detail
    const msg =
      typeof detail === 'string'
        ? detail
        : Array.isArray(detail) && detail.length
          ? detail[0]
          : data?.error

    // A 403 on a console-scoped call means the token is still valid but the
    // session has lost the capability the whole console is built on — the
    // partner-management flag being revoked while the screen was open. Clicking
    // again walks into the same wall, so the session is dropped and its console
    // returns to its own login with the reason waiting there. Calls with no
    // loginRoute (the public API) fall through to ordinary error handling: a
    // refused write is not a lost session.
    if (res.status === 403 && options.loginRoute && !options.allow403) {
      clearAuth(tokenKey, adminKey)
      sessionStorage.setItem(
        'dp_login_notice',
        typeof detail === 'string' && detail ? detail : 'Your access to this console was revoked.',
      )
      window.location.hash = options.loginRoute
      window.location.reload()
      throw new Error('Access revoked — please sign in again.')
    }

    if (data?.error === 'rate_limited' || data?.error === '429') {
      throw new Error('Too many requests. Please wait a moment and try again.')
    }
    if (data?.error === 'order_state') throw new Error(msg || 'Order is no longer payable.')
    if (data?.error === 'not_sellable') throw new Error(msg || 'This package is no longer available.')
    if (data?.error === 'not_found') throw new Error(msg || 'Order not found.')
    // Field errors arrive as { errors: { field: message } } under a plain
    // "Validation failed" message from several controllers, not only under the
    // validation_failed code, so the shape is what is matched on.
    if (data?.error === 'validation_failed' || (data?.errors && typeof data.errors === 'object' && !Array.isArray(data.errors))) {
      const errs = data?.errors
      if (errs && typeof errs === 'object') {
        const first = Object.entries(errs)[0]
        throw new Error(first ? `${first[0]}: ${first[1]}` : 'Please check the highlighted fields.')
      }
    }
    throw new Error(msg || data?.error || `Request failed (${res.status}).`)
  }

  return data
}

/* ── Public API ─────────────────────────────────────── */
export const api = {
  getNetworks: () => request('GET', '/v1/networks'),
  getPackages: (networkId) => request('GET', `/v1/networks/${networkId}/packages`),
  createOrder: (packageId, phone, idempotencyKey = null) => {
    const headers = idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}
    return request('POST', '/v1/orders', { package_id: packageId, phone }, { headers })
  },
  initPayment: (ref, email = null) =>
    request('POST', `/v1/orders/${encodeURIComponent(ref)}/init`, email ? { email } : {}),
  getOrder: (ref) => request('GET', `/v1/orders/${encodeURIComponent(ref)}`),
  lookup: (query) => {
    const key = query.trim()
    const isRef = /[A-Za-z]/.test(key)
    const qs = isRef ? `ref=${encodeURIComponent(key)}` : `phone=${encodeURIComponent(key)}`
    return request('GET', `/v1/lookup?${qs}`)
  },
}

/* ── Admin API (JWT required) ───────────────────────── */
export const adminApi = {
  login: (email, password) =>
    request('POST', '/v1/admin/login', { email, password }, { allow401: true }),
  me: () => request('GET', '/v1/admin/me'),

  // Networks
  getNetworks: (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return request('GET', `/v1/admin/networks${qs ? '?' + qs : ''}`)
  },
  createNetwork: (data) => request('POST', '/v1/admin/networks', data),
  updateNetwork: (id, data) => request('PUT', `/v1/admin/networks/${id}`, data),
  deleteNetwork: (id) => request('DELETE', `/v1/admin/networks/${id}`),

  // Packages
  getPackages: (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return request('GET', `/v1/admin/packages${qs ? '?' + qs : ''}`)
  },
  createPackage: (data) => request('POST', '/v1/admin/packages', data),
  updatePackage: (id, data) => request('PUT', `/v1/admin/packages/${id}`, data),
  deletePackage: (id) => request('DELETE', `/v1/admin/packages/${id}`),

  // Providers
  getProviders: (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return request('GET', `/v1/admin/providers${qs ? '?' + qs : ''}`)
  },
  createProvider: (data) => request('POST', '/v1/admin/providers', data),
  updateProvider: (id, data) => request('PUT', `/v1/admin/providers/${id}`, data),
  deleteProvider: (id) => request('DELETE', `/v1/admin/providers/${id}`),
  // Replaces the provider's linked networks outright — the endpoint takes the
  // full set, not a delta, so the caller sends every network it wants kept.
  syncProviderNetworks: (id, networkIds) =>
    request('POST', `/v1/admin/providers/${id}/networks`, { network_ids: networkIds }),
  getProviderPackages: (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return request('GET', `/v1/admin/provider-packages${qs ? '?' + qs : ''}`)
  },
  syncProvider: (id) => request('POST', `/v1/admin/providers/${id}/sync`),
  getProviderBalances: () => request('GET', '/v1/admin/providers/balances'),

  // Routing
  getRouting: () => request('GET', '/v1/admin/routing'),
  updateRouting: (networkId, providerIds) =>
    request('PUT', `/v1/admin/routing/${networkId}`, { provider_ids: providerIds }),

  // Orders
  getOrders: (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return request('GET', `/v1/admin/orders${qs ? '?' + qs : ''}`)
  },
  getOrder: (id) => request('GET', `/v1/admin/orders/${id}`),
  changeStatus: (id, status, note) =>
    request('POST', `/v1/admin/orders/${id}/status`, { status, note }),
  refreshStatus: (id) => request('POST', `/v1/admin/orders/${id}/refresh-status`),
  retryProviders: (id) => request('GET', `/v1/admin/orders/${id}/retry-providers`),
  retry: (id, providerId = null) => request('POST', `/v1/admin/orders/${id}/retry`, providerId ? { provider_id: providerId } : {}),

  // Refunds
  getRefunds: (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return request('GET', `/v1/admin/refunds${qs ? '?' + qs : ''}`)
  },
  refundOrder: (orderId, reason = '') =>
    request('POST', '/v1/admin/refunds', { order_id: orderId, reason }),
  refundOrdersBulk: (orderIds, reason = '') =>
    request('POST', '/v1/admin/refunds/bulk', { order_ids: orderIds, reason }),
  getRefundHistory: (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return request('GET', `/v1/admin/refunds/history${qs ? '?' + qs : ''}`)
  },
  cancelRefund: (id) => request('POST', `/v1/admin/refunds/${id}/cancel`),

  // Webhook events
  getWebhookEvents: (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return request('GET', `/v1/admin/webhook-events${qs ? '?' + qs : ''}`)
  },

  // Analytics
  getOverview: (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return request('GET', `/v1/admin/analytics/overview${qs ? '?' + qs : ''}`)
  },
  getDaily: (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return request('GET', `/v1/admin/analytics/daily${qs ? '?' + qs : ''}`)
  },
  getTopPackages: (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return request('GET', `/v1/admin/analytics/top-packages${qs ? '?' + qs : ''}`)
  },
  getByNetwork: (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return request('GET', `/v1/admin/analytics/networks${qs ? '?' + qs : ''}`)
  },
  getByProvider: (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return request('GET', `/v1/admin/analytics/providers${qs ? '?' + qs : ''}`)
  },
}