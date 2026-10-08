/**
 * Tenant dashboard API client — the partner's own console.
 *
 * Third independent session alongside the admin token and the partner-console
 * token, for the same reason as those two: a partner is not an operator, their
 * session must not be accepted where an operator's is, and an expired partner
 * session must not bounce somebody out of the admin console in the other tab.
 * Every call therefore carries its own token key and its own 401 destination.
 *
 * One difference from partnerApi: the tenant dashboard signs in with a tenant
 * account (email + password against /v1/tenant/login), not with an admin
 * credential, and there is no permission to check on the way in — being the
 * tenant is the permission.
 */

import {
  request,
  getToken,
  setToken,
  getAdmin,
  setAdmin,
  clearAuth,
} from './api'

const TOKEN_KEY = 'dp_tenant_token'
const TENANT_KEY = 'dp_tenant'
const BASE = '/v1/tenant'

const call = (method, path, body = null, options = {}) =>
  request(method, `${BASE}${path}`, body, {
    tokenKey: TOKEN_KEY,
    adminKey: TENANT_KEY,
    loginRoute: '#/partners',
    ...options,
  })

const qs = (params = {}) => {
  const search = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== null && v !== undefined && v !== '') search.set(k, v)
  }
  const out = search.toString()
  return out ? `?${out}` : ''
}

export const getTenantToken = () => getToken(TOKEN_KEY)
export const getTenantProfile = () => getAdmin(TENANT_KEY)

export function clearTenantAuth() {
  clearAuth(TOKEN_KEY, TENANT_KEY)
}

/** Store the profile the sign-in returned, so the shell has a name to show. */
export function setTenantProfile(tenant) {
  setAdmin(tenant, TENANT_KEY)
}

export async function tenantLogin(email, password) {
  if (!email?.trim()) {
    return { ok: false, code: 'error', error: 'Email is required.' }
  }

  // The password may be empty on purpose: a tenant created by the partner
  // admin has no password yet and signs in with the email alone. The server
  // answers with `must_set_password`, and the dashboard refuses them
  // everything else until they choose one.
  try {
    const res = await request(
      'POST',
      `${BASE}/login`,
      { email: email.trim().toLowerCase(), password: password || '' },
      {
        allow401: true,
        tokenKey: TOKEN_KEY,
        adminKey: TENANT_KEY,
        loginRoute: '#/partners',
      },
    )

    const data = res.data || res
    if (!data.token) return { ok: false, code: 'error', error: 'Sign-in failed.' }

    setToken(data.token, TOKEN_KEY)
    setTenantProfile(data.tenant)

    return { ok: true, tenant: data.tenant, mustSetPassword: !!data.must_set_password }
  } catch (err) {
    const msg = err?.message || 'Sign-in failed'
    if (/too many|429|throttl/i.test(msg)) {
      return { ok: false, code: 'rate_limited', error: 'Too many attempts. Please try again later.' }
    }
    // The server refuses unknown address and wrong password with one message,
    // so this is everything a wrong sign-in can say.
    if (/details are not valid/i.test(msg)) {
      return { ok: false, code: 'bad_credentials', error: 'Email or password is not correct.' }
    }
    return { ok: false, code: 'error', error: msg }
  }
}

/**
 * Open a new dealer account. Unlike every other call here this one is
 * unauthenticated — it *creates* the session it returns, so on success the
 * token and profile are stored exactly as a sign-in would store them and the
 * caller can treat the registrant as signed in.
 */
export async function tenantRegister({ name, email, phone, password }) {
  if (!name?.trim() || !email?.trim() || !password) {
    return { ok: false, code: 'error', error: 'Name, email and password are required.' }
  }
  if (password.length < 8) {
    return { ok: false, code: 'error', error: 'Password must be at least 8 characters.' }
  }

  try {
    const res = await request(
      'POST',
      `${BASE}/register`,
      {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        ...(phone?.trim() ? { phone: phone.trim() } : {}),
        password,
      },
      {
        allow401: true,
        tokenKey: TOKEN_KEY,
        adminKey: TENANT_KEY,
        loginRoute: '#/partners',
      },
    )

    const data = res.data || res
    if (!data.token) return { ok: false, code: 'error', error: 'Registration failed.' }

    setToken(data.token, TOKEN_KEY)
    setTenantProfile(data.tenant)

    return { ok: true, tenant: data.tenant }
  } catch (err) {
    const msg = err?.message || 'Registration failed'
    if (/too many|429|throttl/i.test(msg)) {
      return { ok: false, code: 'rate_limited', error: 'Too many attempts. Please try again in a few minutes.' }
    }
    if (/already in use/i.test(msg)) {
      return { ok: false, code: 'email_taken', error: 'An account with that email already exists — try signing in instead.' }
    }
    if (/not open right now/i.test(msg)) {
      return { ok: false, code: 'unavailable', error: msg }
    }
    return { ok: false, code: 'error', error: msg }
  }
}

/**
 * Is this session still good?
 *
 * Checked against the server rather than trusted from storage: a session that
 * was dropped when the account was suspended must land on the login screen,
 * not on a shell of failed requests.
 */
export async function tenantIsAuthenticated() {
  if (!getTenantToken()) return false

  try {
    const res = await request('GET', `${BASE}/console/profile`, null, {
      allow401: true,
      tokenKey: TOKEN_KEY,
      adminKey: TENANT_KEY,
      loginRoute: '#/partners',
    })
    const tenant = res.data
    if (!tenant?.id) {
      clearTenantAuth()
      return false
    }
    setTenantProfile(tenant)
    return true
  } catch {
    clearTenantAuth()
    return false
  }
}

export function tenantLogout() {
  clearTenantAuth()
  window.location.hash = '#/partners'
  window.location.reload()
}

export const tenantApi = {
  /* Account */
  getProfile: () => call('GET', '/console/profile'),
  updateProfile: (data) => call('PUT', '/console/profile', data),

  /* Business analytics */
  getAnalytics: (params) => call('GET', `/console/analytics${qs(params)}`),

  /* API keys — session only: a key may never mint a key. */
  getApiKeys: () => call('GET', '/console/api-keys'),
  issueApiKey: (data) => call('POST', '/console/api-keys', data),
  revokeApiKey: (id) => call('POST', `/console/api-keys/${id}/revoke`),

  /* Catalogue — priced for this tenant's tier, not at list price. */
  getNetworks: () => call('GET', '/catalog/networks'),
  getPackages: (networkId) => call('GET', `/catalog/networks/${networkId}/packages`),

  /* Orders */
  getOrders: (params) => call('GET', `/orders${qs(params)}`),
  getOrder: (ref) => call('GET', `/orders/${encodeURIComponent(ref)}`),
  /**
   * A purchase moves real money, so the Idempotency-Key is generated by the
   * caller per submission rather than left off: a double click, a retry after
   * a timeout, or a browser resubmit must not buy the bundle twice.
   */
  purchase: (data, idempotencyKey) =>
    call('POST', '/orders', data, {
      headers: { 'Idempotency-Key': idempotencyKey },
      // A refusal to spend (no funds, would breach the reserve) is information
      // about the wallet, not a dead session — it must not sign the partner
      // out of the dashboard they are looking at.
      allow403: true,
    }),

  /* Wallet */
  getWallet: () => call('GET', '/wallet'),
  getEntries: (params) => call('GET', `/wallet/entries${qs(params)}`),
  topup: (data, idempotencyKey) =>
    call('POST', '/wallet/topup', data, {
      headers: { 'Idempotency-Key': idempotencyKey },
      allow403: true,
    }),

  /**
   * Payment transactions — the charges themselves, which are deliberately a
   * different list from the ledger above: entries are balance movements, these
   * are what Paystack holds, and they are what you read when a credit is late.
   */
  getTopups: (params) => call('GET', `/wallet/topups${qs(params)}`),
  getTopup: (ref) => call('GET', `/wallet/topups/${encodeURIComponent(ref)}`),

  /**
   * Ask Paystack about one transaction and settle it from the answer. The
   * webhook is the normal path; this is the fallback when it was late or lost.
   * It applies the same rules a webhook does, so it can credit at most once.
   *
   * A 502 here means the gateway was unreachable — the transaction is
   * unchanged, never a reason to pay again — and a refusal to spend or verify
   * is information, not a dead session.
   */
  verifyTopup: (ref) =>
    call('POST', `/wallet/topups/${encodeURIComponent(ref)}/verify`, null, {
      allow403: true,
    }),
}
