/**
 * DataPadi shared helpers — money, dates, status vocabulary.
 */

export const currency = (value) =>
  `₵${Number(value || 0).toFixed(2)}`

export const formatDate = (iso) => {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-GH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export const formatDateTime = (iso) => {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('en-GH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export const timeAgo = (iso) => {
  if (!iso) return '—'
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'yesterday'
  return `${days}d ago`
}

/** Order lifecycle status → label + pill classes. */
export const STATUS_META = {
  PENDING_PAYMENT: { label: 'Pending payment', cls: 'bg-accent-soft text-accent-dark' },
  PAID: { label: 'Paid', cls: 'bg-sky-50 text-sky-700' },
  SUBMITTED: { label: 'Delivering', cls: 'bg-violet-50 text-violet-700' },
  SUCCESS: { label: 'Delivered', cls: 'bg-emerald-50 text-emerald-700' },
  FAILED: { label: 'Failed', cls: 'bg-red-50 text-red-600' },
  SUPERVISED: { label: 'Needs review', cls: 'bg-rose-50 text-rose-600' },
  REFUNDED: { label: 'Refunded', cls: 'bg-emerald-50 text-emerald-700' },
  EXPIRED: { label: 'Expired', cls: 'bg-slate-100 text-slate-500' },
}

export const statusMeta = (status) =>
  STATUS_META[status] || { label: status || '—', cls: 'bg-slate-100 text-slate-500' }

/** Customer-refund lifecycle (refunds table status). */
export const REFUND_META = {
  pending: { label: 'Pending', cls: 'bg-slate-100 text-slate-500' },
  processing: { label: 'Refunding', cls: 'bg-amber-50 text-amber-700' },
  refunded: { label: 'Refunded', cls: 'bg-emerald-50 text-emerald-700' },
  failed: { label: 'Refund failed', cls: 'bg-red-50 text-red-600' },
}

export const refundMeta = (status) =>
  REFUND_META[status] || { label: status || 'Not started', cls: 'bg-slate-100 text-slate-500' }

/** Network code → short label + dot colour for chips. */
export const NETWORK_DOT = {
  MTN: 'bg-amber-400',
  AIRTELTIGO: 'bg-orange-500',
  AT: 'bg-orange-500',
  TELECEL: 'bg-emerald-400',
}

/** Is the customer waiting on this order? */
export const isActivePayment = (status) =>
  status === 'PENDING_PAYMENT' || status === 'PAID' || status === 'SUBMITTED'