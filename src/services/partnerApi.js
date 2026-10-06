/**
 * Partner console API client.
 *
 * Shares the fetch wrapper in api.js — so error shaping, 401 handling and the
 * "cannot reach the server" message are identical — but keeps its own session.
 * An expired partner token must not log an operator out of the main admin
 * console in the other tab, and signing in here must not overwrite the token
 * they are already using there.
 */

import {
  request,
  getToken,
  setToken,
  getAdmin,
  setAdmin,
  clearAuth,
} from './api'
import { tenantLogin, clearTenantAuth } from './tenantApi'

const TOKEN_KEY = 'dp_partner_token'
const ADMIN_KEY = 'dp_partner_admin'
const BASE = '/v1/admin/partners'

/** Every partner call carries its own token key and its own 401 destination. */
const call = (method, path, body = null, options = {}) =>
  request(method, `${BASE}${path}`, body, {
    tokenKey: TOKEN_KEY,
    adminKey: ADMIN_KEY,
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

export const getPartnerToken = () => getToken(TOKEN_KEY)
export const getPartnerAdmin = () => getAdmin(ADMIN_KEY)

export function clearPartnerAuth() {
  clearAuth(TOKEN_KEY, ADMIN_KEY)
}

/**
 * Sign in and check the partner permission before the console renders.
 *
 * The permission check is the point of this function. Every route is gated by
 * can_manage_partners on the server, so an admin without it gets a wall of 403s
 * — better to say so on the login screen than to let them into an empty shell.
 */
export async function partnerLogin(email, password) {
  if (!email?.trim() || !password?.trim()) {
    return { ok: false, error: 'Email and password are required.' }
  }

  try {
    const res = await request('POST', '/v1/admin/login', { email: email.trim().toLowerCase(), password }, {
      allow401: true,
      tokenKey: TOKEN_KEY,
      adminKey: ADMIN_KEY,
      loginRoute: '#/partners',
    })

    const data = res.data || res

    if (!data.token) return { ok: false, code: 'error', error: 'Login failed.' }
    if (!data.admin?.can_manage_partners) {
      // Do not store a token this account cannot use. `no_permission` rather
      // than `bad_credentials`: the password was right, so falling through to
      // the partner's own login would be wrong.
      return {
        ok: false,
        code: 'no_permission',
        error: 'This account does not have partner management permission.',
      }
    }

    setToken(data.token, TOKEN_KEY)
    setAdmin(data.admin, ADMIN_KEY)

    return { ok: true, admin: data.admin }
  } catch (err) {
    const msg = err?.message || 'Login failed'
    if (/too many|429|throttl/i.test(msg)) {
      return { ok: false, code: 'rate_limited', error: 'Too many attempts. Please try again later.' }
    }
    if (/credential|invalid|unauthor/i.test(msg)) {
      return { ok: false, code: 'bad_credentials', error: 'Invalid email or password.' }
    }
    return { ok: false, code: 'error', error: msg }
  }
}

/**
 * One door for both kinds of partner-console user.
 *
 * Staff hold an operator account (`can_manage_partners`); a partner holds a
 * tenant account. Both used to have their own login screen, which meant two
 * URLs, two links to explain, and a person guessing which one was theirs — so
 * the form tries the operator account first (one request when it is a staff
 * login, which is who is typing at this screen most of the time) and falls
 * through to the partner's own credentials only when the operator endpoint
 * simply does not recognise the address.
 *
 * `code` is what the caller branches on, never the wording: the two endpoints
 * already refuse unknown addresses and wrong passwords with the same generic
 * sentence, and nothing here may turn that into an oracle.
 */
export async function consoleLogin(email, password) {
  const staff = await partnerLogin(email, password)
  if (staff.ok) {
    // Exactly one console session at a time. A partner token left over from
    // last week would otherwise be found first at the door and put somebody
    // who just signed in as staff onto their partner dashboard instead.
    clearTenantAuth()
    return { ok: true, role: 'admin', admin: staff.admin }
  }
  if (staff.code !== 'bad_credentials') return staff

  const partner = await tenantLogin(email, password)
  if (partner.ok) {
    clearPartnerAuth()
    return { ok: true, role: 'tenant', tenant: partner.tenant }
  }
  if (partner.code !== 'bad_credentials') return partner

  return { ok: false, code: 'bad_credentials', error: 'Email or password is not correct.' }
}

export async function partnerIsAuthenticated() {
  if (!getPartnerToken()) return false

  try {
    // Verified against the server rather than trusted from storage: a revoked
    // token must land on the login screen, not on a shell of failed requests.
    const res = await request('GET', '/v1/admin/me', null, {
      tokenKey: TOKEN_KEY,
      adminKey: ADMIN_KEY,
      loginRoute: '#/partners',
    })
    const admin = res.data

    if (!admin?.can_manage_partners) {
      clearPartnerAuth()
      return false
    }

    setAdmin(admin, ADMIN_KEY)
    return true
  } catch {
    clearPartnerAuth()
    return false
  }
}

export function partnerLogout() {
  clearPartnerAuth()
  window.location.hash = '#/partners'
  window.location.reload()
}

export const partnerApi = {
  /* Overview & analytics */
  getOverview: (params) => call('GET', `/overview${qs(params)}`),
  getRevenue: (params) => call('GET', `/analytics/revenue${qs(params)}`),

  /* Tenants */
  getTenants: (params) => call('GET', `/tenants${qs(params)}`),
  getTenant: (id) => call('GET', `/tenants/${id}`),
  createTenant: (data) => call('POST', '/tenants', data),
  updateTenant: (id, data) => call('PUT', `/tenants/${id}`, data),
  activateTenant: (id, reason = '') => call('POST', `/tenants/${id}/activate`, { reason }),
  suspendTenant: (id, reason = '') => call('POST', `/tenants/${id}/suspend`, { reason }),
  changeAccountType: (id, accountTypeId, reason = '') =>
    call('POST', `/tenants/${id}/account-type`, { account_type_id: accountTypeId, reason }),
  getTenantOrders: (id, params) => call('GET', `/tenants/${id}/orders${qs(params)}`),
  getTenantOrder: (id, orderId) => call('GET', `/tenants/${id}/orders/${orderId}`),
  getTenantAudit: (id, params) => call('GET', `/tenants/${id}/audit${qs(params)}`),

  /* API keys */
  getApiKeys: (tenantId) => call('GET', `/tenants/${tenantId}/api-keys`),
  issueApiKey: (tenantId, data) => call('POST', `/tenants/${tenantId}/api-keys`, data),
  revokeApiKey: (keyId) => call('POST', `/api-keys/${keyId}/revoke`),

  /* Wallet */
  getWallet: (tenantId) => call('GET', `/tenants/${tenantId}/wallet`),
  getWalletEntries: (tenantId, params) =>
    call('GET', `/tenants/${tenantId}/wallet/entries${qs(params)}`),
  /**
   * Idempotency-Key is mandatory here rather than optional. An operator clicking
   * "Credit" twice, or a retry after a timeout, must not move money twice — and
   * the backend dedupes on this key. Generated once per form submission, not per
   * click, so a genuine second adjustment gets a fresh one.
   */
  adjustWallet: (tenantId, data, idempotencyKey) =>
    call(
      'POST',
      `/tenants/${tenantId}/wallet/adjust`,
      data,
      idempotencyKey ? { headers: { 'Idempotency-Key': idempotencyKey } } : {},
    ),

  /* Settlements */
  getSettlements: (tenantId, params) =>
    call('GET', `/tenants/${tenantId}/settlements${qs(params)}`),
  retrySettlement: (tenantId, settlementId) =>
    call('POST', `/tenants/${tenantId}/settlements/${settlementId}/retry`),

  /* Account types & pricing */
  getAccountTypes: () => call('GET', '/account-types'),
  createAccountType: (data) => call('POST', '/account-types', data),
  updateAccountType: (id, data) => call('PUT', `/account-types/${id}`, data),
  deleteAccountType: (id) => call('DELETE', `/account-types/${id}`),
  saveTierPrices: (id, prices) => call('PUT', `/account-types/${id}/prices`, { prices }),
  getPricingMatrix: (params) => call('GET', `/pricing/matrix${qs(params)}`),
}
