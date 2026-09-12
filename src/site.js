/**
 * Site identity — everything brandable lives here so renaming is one file.
 */
export const SITE = {
  name: 'DataPadi',
  tagline: 'Buy mobile data bundles in seconds',
  heroTitle: 'Data for every moment, delivered instantly',
  heroSub:
    'MTN, AirtelTigo & Telecel bundles for every budget. Pay with mobile money or card and get connected in seconds.',
  supportEmail: 'support@datapadi.com',
  supportPhone: '+233 20 000 0000',
  copyright: '© 2026 DataPadi · Instant data bundles in Ghana',
  networksServed: 'MTN · AirtelTigo · Telecel',
}

/** Per-network accent (cap / chip colours) — fallback gradient used otherwise. */
export const NETWORK_COLORS = {
  MTN: 'from-amber-300 to-yellow-500 text-amber-950',
  AIRTELTIGO: 'from-orange-400 to-rose-500',
  AT: 'from-orange-400 to-rose-500',
  TELECEL: 'from-emerald-300 to-teal-500',
  DEFAULT: 'from-brand to-accent',
}