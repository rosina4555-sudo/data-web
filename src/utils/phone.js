/**
 * Ghana phone parsing / validation + network detection by prefix.
 */

export const networkForPrefix = (phone) => {
  if (!/^\d{10}$/.test(phone || '')) return null
  const p = phone.slice(0, 3)
  if (['024', '025', '054', '055', '059'].includes(p)) return 'MTN'
  if (['027', '057'].includes(p)) return 'AirtelTigo'
  if (['020', '050'].includes(p)) return 'Telecel'
  if (p === '026') return 'AirtelTigo'
  return null
}

export const isValidGhanaPhone = (phone) => {
  const cleaned = (phone || '').replace(/[\s-]/g, '')
  if (cleaned.startsWith('+233')) {
    return /^\+233[0-9]{9}$/.test(cleaned)
  }
  return /^0[0-9]{9}$/.test(cleaned)
}

export const normalizePhone = (phone) => {
  let p = (phone || '').replace(/[\s-]/g, '')
  if (p.startsWith('+233')) p = '0' + p.slice(4)
  return p
}

export const phoneHint = (phone) => {
  const p = (phone || '').replace(/\D/g, '')
  if (p.startsWith('233')) return '0' + p.slice(3)
  if (p.startsWith('0')) return p
  return p
}