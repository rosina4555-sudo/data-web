/**
 * Partner-console formatters.
 *
 * Kept separate from utils/format.js on purpose: that file is shared with the
 * main admin console, and these are the partner vocabulary — tiers, settlement
 * lifecycle, tenant status. Adding them there would put partner concepts into a
 * file the existing console imports.
 */

import { currency } from './format'

export { currency }

/**
 * Minor units → display string.
 *
 * Every money figure that crosses the API is in minor units (pesewa), because
 * that is what the wallet ledger stores and what floating point would corrupt.
 * `currency()` in the shared formatters expects major units, so this converts
 * once, here, rather than at every call site.
 */
export const money = (minor) => currency(Number(minor || 0) / 100)

/** bps → percentage string. Null renders as an em dash, never as 0%. */
export const percent = (bps) =>
  bps === null || bps === undefined ? '—' : `${(Number(bps) / 100).toFixed(1)}%`

export const TENANT_STATUS_META = {
  active: { label: 'Active', cls: 'bg-emerald-50 text-emerald-700' },
  suspended: { label: 'Suspended', cls: 'bg-amber-50 text-amber-700' },
  closed: { label: 'Closed', cls: 'bg-slate-100 text-slate-500' },
}

export const tenantStatusMeta = (status) =>
  TENANT_STATUS_META[status] || { label: status || '—', cls: 'bg-slate-100 text-slate-500' }

/**
 * Payment transactions, as Paystack reports them.
 *
 * `pending` is amber because the money may already have left the partner and
 * simply not reached us yet — it is the one state that can still move, and the
 * one with a "check with Paystack" button attached to it.
 */
export const TOPUP_STATUS_META = {
  pending: { label: 'Awaiting Paystack', cls: 'bg-amber-50 text-amber-700' },
  success: { label: 'Paid', cls: 'bg-emerald-50 text-emerald-700' },
  failed: { label: 'Failed', cls: 'bg-red-50 text-red-600' },
  expired: { label: 'Expired', cls: 'bg-slate-100 text-slate-500' },
}

export const topupStatusMeta = (status) =>
  TOPUP_STATUS_META[status] || { label: status || '—', cls: 'bg-slate-100 text-slate-500' }

/**
 * Settlement lifecycle.
 *
 * `pending` is amber rather than slate: it is money we owe a partner that has not
 * moved yet, and the watchdog will park it at five attempts. An operator should
 * be able to spot the queue from across the room.
 */
export const SETTLEMENT_META = {
  pending: { label: 'Queued', cls: 'bg-amber-50 text-amber-700' },
  applied: { label: 'Paid', cls: 'bg-emerald-50 text-emerald-700' },
  failed: { label: 'Failed', cls: 'bg-red-50 text-red-600' },
  skipped: { label: 'Skipped', cls: 'bg-slate-100 text-slate-500' },
}

export const settlementMeta = (status) =>
  SETTLEMENT_META[status] || { label: status || '—', cls: 'bg-slate-100 text-slate-500' }

/** Audit action → label + pill colour. Mirrors the backend's constants. */
export const AUDIT_META = {
  activated: { label: 'Activated', cls: 'bg-emerald-50 text-emerald-700' },
  suspended: { label: 'Suspended', cls: 'bg-amber-50 text-amber-700' },
  tier_changed: { label: 'Tier changed', cls: 'bg-sky-50 text-sky-700' },
  key_issued: { label: 'Key issued', cls: 'bg-violet-50 text-violet-700' },
  key_revoked: { label: 'Key revoked', cls: 'bg-red-50 text-red-600' },
  wallet_adjusted: { label: 'Wallet adjusted', cls: 'bg-indigo-50 text-indigo-700' },
  settlement_retry: { label: 'Settlement retry', cls: 'bg-amber-50 text-amber-700' },
  balance_rebuilt: { label: 'Balance rebuilt', cls: 'bg-teal-50 text-teal-700' },
  registered: { label: 'Self-registered', cls: 'bg-blue-50 text-blue-700' },
}

export const auditMeta = (action) =>
  AUDIT_META[action] || { label: action || '—', cls: 'bg-slate-100 text-slate-500' }

/** Does this settlement still need a human? */
export const isRetryable = (settlement) =>
  settlement?.status === 'failed' || settlement?.status === 'pending'

export const newIdempotencyKey = () =>
  `console-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
