/**
 * Paystack payment — single integration point for the customer checkout.
 *
 * Flow: the backend already created the order and called Paystack's
 * initialize endpoint (POST /v1/orders/{ref}/init). It returns the Paystack
 * access_code for that transaction; we resume it in the Paystack inline
 * popup via resumeTransaction — no public key required.
 */

import PaystackPop from '@paystack/inline-js'

/**
 * @returns Promise<string>  resolves with the Paystack reference on success.
 */
export function openPaystack({ accessCode, onClose }) {
  if (!accessCode) {
    throw new Error('Payment gateway did not return an access code.')
  }

  return new Promise((resolve, reject) => {
    let settled = false
    const popup = new PaystackPop()

    popup.resumeTransaction(accessCode, {
      onSuccess: (transaction) => {
        settled = true
        resolve(transaction?.reference || transaction?.trxref || accessCode)
      },
      onCancel: () => {
        if (settled) return
        if (onClose) onClose()
        reject(new Error('Payment cancelled'))
      },
      onError: (err) => {
        if (settled) return
        if (onClose) onClose()
        reject(new Error(err?.message || 'Payment failed. Please try again.'))
      },
    })
  })
}