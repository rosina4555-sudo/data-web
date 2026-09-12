import { reactive } from 'vue'

export const toasts = reactive([])

let counter = 0

export function toast(message, type = 'info', timeout = 4200) {
  const id = ++counter
  toasts.push({ id, message, type })
  setTimeout(() => dismiss(id), timeout)
  return id
}

export function dismiss(id) {
  const i = toasts.findIndex((t) => t.id === id)
  if (i !== -1) toasts.splice(i, 1)
}