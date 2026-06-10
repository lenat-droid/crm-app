// ── Unified Toast / Notification System ──
// Wraps antd message with consistent styling and behavior

import { message } from 'antd'

type MessageType = 'success' | 'error' | 'warning' | 'info'

interface ToastOptions {
  /** Duration in seconds (default 3) */
  duration?: number
  /** Callback when toast closes */
  onClose?: () => void
}

const DEFAULT_DURATION = 3

/**
 * Show a success toast
 */
export function toastSuccess(content: string, options?: ToastOptions) {
  message.success({
    content,
    duration: options?.duration ?? DEFAULT_DURATION,
    onClose: options?.onClose,
  })
}

/**
 * Show an error toast
 */
export function toastError(content: string, options?: ToastOptions) {
  message.error({
    content,
    duration: options?.duration ?? DEFAULT_DURATION * 2, // errors stay longer
    onClose: options?.onClose,
  })
}

/**
 * Show a warning toast
 */
export function toastWarning(content: string, options?: ToastOptions) {
  message.warning({
    content,
    duration: options?.duration ?? DEFAULT_DURATION,
    onClose: options?.onClose,
  })
}

/**
 * Show an info toast
 */
export function toastInfo(content: string, options?: ToastOptions) {
  message.info({
    content,
    duration: options?.duration ?? DEFAULT_DURATION,
    onClose: options?.onClose,
  })
}

/**
 * Handle API response errors uniformly.
 * Shows error toast and returns the error message.
 */
export function handleApiError(err: unknown, fallbackMsg = '操作失敗'): string {
  let msg = fallbackMsg

  if (err instanceof Error) {
    msg = err.message || fallbackMsg
  } else if (typeof err === 'string') {
    msg = err
  }

  // Check for common HTTP error patterns
  if (msg.includes('Unauthorized')) {
    msg = '登入已過期，請重新登入'
  } else if (msg.includes('Forbidden') || msg.includes('403')) {
    msg = '沒有權限執行此操作'
  } else if (msg.includes('Not Found') || msg.includes('404')) {
    msg = '請求的資源不存在'
  } else if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
    msg = '網絡連接失敗，請檢查網絡'
  }

  toastError(msg)
  return msg
}

/**
 * Fetch wrapper with unified error handling.
 * Returns [data, error] tuple.
 */
export async function apiFetch<T = any>(
  url: string,
  options?: RequestInit
): Promise<[T, null] | [null, string]> {
  try {
    const res = await fetch(url, options)
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      const errMsg = body.error || body.message || `HTTP ${res.status}`
      throw new Error(errMsg)
    }
    const data = await res.json()
    return [data, null]
  } catch (err) {
    const msg = handleApiError(err)
    return [null, msg]
  }
}
