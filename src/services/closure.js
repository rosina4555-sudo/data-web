/**
 * Temporary closure switch.
 *
 * While `SITE_CLOSED` is true the router renders the closure notice for every
 * public page — the home page, a shopfront, a bookmarked bundle link — so
 * nothing public loads real catalogue data and no checkout can be opened.
 * Order tracking and the admin console stay reachable, so people can still
 * trace orders they already paid for and staff can still run the business.
 * Dealer and seller sign-ins are closed with everything else — a direct link to
 * their console must not become a way back into a shop that is meant to be
 * shut.
 *
 * Controlled from `.env` at build time:
 *
 *   VITE_SITE_CLOSED=true    # closed (also 1 / on / yes)
 *   VITE_SITE_CLOSED=false   # open   (also 0 / off / no)
 *
 * Reopening is therefore a deploy with `VITE_SITE_CLOSED=false`; no other file
 * changes. Unset or unrecognised defaults to closed, so a build that forgets
 * the variable cannot quietly reopen a shop that is meant to be shut.
 */
const flag = (value, fallback) => {
  if (value === undefined || value === null || String(value).trim() === '') return fallback

  return !['false', '0', 'off', 'no'].includes(String(value).trim().toLowerCase())
}

export const SITE_CLOSED = flag(import.meta.env.VITE_SITE_CLOSED, true)

/**
 * Routes that keep working while the shop is closed. Everything else is
 * replaced by the closure notice.
 *
 *   #/admin — staff sign-in and operator console
 *   #/track — order tracking for orders already placed
 */
export const CLOSED_ALLOWED_PATHS = ['#/admin', '#/track']

export const isRouteAllowedWhileClosed = (hash = '') => {
  const path = String(hash || '').split('?')[0]

  return CLOSED_ALLOWED_PATHS.some(
    (allowed) => path === allowed || path.startsWith(`${allowed}/`),
  )
}

/** True when this hash should render the closure notice instead of the page. */
export const closureBlocks = (hash = '') => SITE_CLOSED && !isRouteAllowedWhileClosed(hash)

/** False while the shop is closed — every purchase path checks this. */
export const purchasesOpen = () => !SITE_CLOSED

export const CLOSURE = {
  badge: 'A quick notice',
  title: "We're closed for a little while",
  body:
    "We've paused new orders while we sort out a few things behind the scenes. If you've already ordered, nothing is lost — your order is still with us and goes out the moment we're back.",
  note:
    "Please hold off on any new payments until then, so you're not left waiting on us. If you've already paid, you can check where things stand below.",
  trackingLabel: 'Check an order you already placed',
}
