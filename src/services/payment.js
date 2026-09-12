/**
 * Paystack payment — single integration point for the customer checkout.
 *
 * Flow: the backend already created the order and called Paystack's
 * initialize endpoint (POST /v1/orders/{ref}/init). It returns a Paystack
 * transaction reference; we open the Paystack popup on that same reference.
 */

import PaystackPop from '@paystack/inline-js'

const PUBLIC_KEY = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY || ''

/**
 * @returns Promise<string>  resolves with the Paystack trxref on success.
 */
export function openPaystack({ key, email, amount, reference, onClose }) {
  if (!key) {
    throw new Error('Paystack is not configured (missing VITE_PAYSTACK_PUBLIC_KEY).')
  }

  return new Promise((resolve, reject) => {
    let settled = false
    const pop = new PaystackPop()
    pop.newTransaction({
      key,
      email,
      amount: Math.round(Number(amount) * 100), // pesewas/kobo
      currency: 'GHS',
      ref: reference,
      onSuccess: (t) => {
        settled = true
        resolve(t?.reference || t?.trxref || reference)
      },
      onCancel: () => {
        if (settled) return
        if (onClose) onClose()
        reject(new Error('Payment cancelled'))
      },
    })
  })
}

export const paystackConfigured = () => Boolean(PUBLIC_KEY)
export const paystackKey = () => PUBLIC_KEY