/**
 * Admin authentication — token stored locally, verified against the backend.
 */

import { adminApi, setToken, setAdmin, getToken, clearAuth } from './api'

export async function login(email, password) {
  if (!email?.trim() || !password?.trim()) {
    return { ok: false, error: 'Email and password are required.' }
  }
  try {
    const res = await adminApi.login(email.trim().toLowerCase(), password)
    const data = res.data || res
    const token = data.token
    const admin = data.admin
    if (token) setToken(token)
    if (admin) setAdmin(admin)
    return { ok: true, admin }
  } catch (err) {
    const msg = err?.message || 'Login failed'
    if (/too many|429|throttl/i.test(msg)) {
      return { ok: false, error: 'Too many attempts. Please try again later.' }
    }
    if (/credential|invalid|unauthor/i.test(msg)) {
      return { ok: false, error: 'Invalid email or password.' }
    }
    return { ok: false, error: msg }
  }
}

export async function isAuthenticated() {
  if (!getToken()) return false
  try {
    await adminApi.me()
    return true
  } catch {
    clearAuth()
    return false
  }
}

export function logout() {
  clearAuth()
  window.location.hash = '#'
  window.location.reload()
}