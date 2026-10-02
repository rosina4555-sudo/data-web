/**
 * DataPadi API client — talks to the Slim backend.
 * JWT stored in localStorage and attached to every admin request.
 */

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080'

const TOKEN_KEY = 'dp_token'
const ADMIN_KEY = 'dp_admin'

/* ── Token management ───────────────────────────────── */
export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}
export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token)
}
export function getAdmin() {
  try {
    return JSON.parse(localStorage.getItem(ADMIN_KEY))
  } catch {
    return null
  }
}
export function setAdmin(admin) {
  localStorage.setItem(ADMIN_KEY, JSON.stringify(admin))
}
export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(ADMIN_KEY)
}
export function isAuthenticated() {
  return !!getToken()
}

/* ── Fetch wrapper ──────────────────────────────────── */
async function request(method, path, body = null, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers }

  const token = getToken()
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
    clearAuth()
    window.location.hash = '#/admin'
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
    if (data?.error === 'rate_limited' || data?.error === '429') {
      throw new Error('Too many requests. Please wait a moment and try again.')
    }
    if (data?.error === 'order_state') throw new Error(msg || 'Order is no longer payable.')
    if (data?.error === 'not_sellable') throw new Error(msg || 'This package is no longer available.')
    if (data?.error === 'not_found') throw new Error(msg || 'Order not found.')
    if (data?.error === 'validation_failed') {
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
  getNetworks: () => request('GET', '/v1/admin/networks'),
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
  getProviders: () => request('GET', '/v1/admin/providers'),
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
  retry: (id) => request('POST', `/v1/admin/orders/${id}/retry`),

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