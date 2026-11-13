/**
 * Storefront API client.
 *
 * Two very different callers share this file:
 *
 *  - the public shop (#/s/{slug}) — no session, sell prices only;
 *  - the store owner's console (#/stores) — its own JWT, stored under its own
 *    key so signing into the admin console never signs a store owner in, or
 *    the other way round.
 */

import { request, getToken, setToken, getAdmin, setAdmin, clearAuth } from './api'

export const STORE_TOKEN_KEY = 'dp_store_token'
export const STORE_KEY = 'dp_store'

// Every authenticated store call carries these so a 401/403 lands on the store
// login instead of the admin one.
const sessionOptions = {
  tokenKey: STORE_TOKEN_KEY,
  adminKey: STORE_KEY,
  loginRoute: '#/stores',
}

export function getStore() {
  return getAdmin(STORE_KEY)
}

export function getStoreToken() {
  return getToken(STORE_TOKEN_KEY)
}

export function clearStoreSession() {
  clearAuth(STORE_TOKEN_KEY, STORE_KEY)
}

export function storeLogout() {
  clearStoreSession()
  window.location.hash = '#/stores'
  window.location.reload()
}

export async function storeIsAuthenticated() {
  if (!getStoreToken()) return false
  try {
    await storeApi.me()
    return true
  } catch {
    clearStoreSession()
    return false
  }
}

function persist(payload) {
  const data = payload?.data || payload
  if (data?.token) setToken(data.token, STORE_TOKEN_KEY)
  if (data?.store) setAdmin(data.store, STORE_KEY)
  return data
}

export async function storeLogin(email, password) {
  const payload = await request(
    'POST',
    '/v1/stores/login',
    { email: String(email || '').trim().toLowerCase(), password },
    { allow401: true },
  )
  return persist(payload)
}

export async function storeRegister(fields) {
  const payload = await request('POST', '/v1/stores/register', fields, { allow401: true })
  return persist(payload)
}

/* ── Public storefront ──────────────────────────────── */

export const storefrontApi = {
  get: (slug) =>
    request('GET', `/v1/storefronts/${encodeURIComponent(slug)}`, null, { allow401: true }),
  packages: (slug) =>
    request('GET', `/v1/storefronts/${encodeURIComponent(slug)}/packages`, null, {
      allow401: true,
    }),
  createOrder: (slug, packageId, phone, idempotencyKey = null) => {
    const headers = idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}
    return request(
      'POST',
      `/v1/storefronts/${encodeURIComponent(slug)}/orders`,
      { package_id: packageId, phone },
      { headers, allow401: true },
    )
  },
}

/* ── Store owner console ────────────────────────────── */

export const storeApi = {
  me: () => request('GET', '/v1/store/me', null, sessionOptions),

  updateProfile: (data) => request('PUT', '/v1/store/profile', data, sessionOptions),
  updatePayout: (data) => request('PUT', '/v1/store/payout', data, sessionOptions),

  packages: () => request('GET', '/v1/store/packages', null, sessionOptions),
  setPackagePrice: (packageId, data) =>
    request('PUT', `/v1/store/packages/${packageId}`, data, sessionOptions),

  orders: (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return request('GET', `/v1/store/orders${qs ? '?' + qs : ''}`, null, sessionOptions)
  },

  earnings: (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return request('GET', `/v1/store/earnings${qs ? '?' + qs : ''}`, null, sessionOptions)
  },
  earningsSummary: () => request('GET', '/v1/store/earnings/summary', null, sessionOptions),

  withdrawals: (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return request('GET', `/v1/store/withdrawals${qs ? '?' + qs : ''}`, null, sessionOptions)
  },
  requestWithdrawal: (amountMinor) =>
    request('POST', '/v1/store/withdrawals', { amount_minor: amountMinor }, sessionOptions),
}
