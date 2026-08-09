import { TFL_BASE } from './constants'
import type { TflAuth } from './types'

function authQuery(auth?: TflAuth): Record<string, string> {
  const params: Record<string, string> = {}
  if (auth?.appKey) params.app_key = auth.appKey
  if (auth?.appId) params.app_id = auth.appId
  return params
}

/**
 * GET a TfL Unified API path with query params.
 * Throws on non-OK responses (callers that want soft-fail should catch).
 */
export async function tflGet<T>(
  path: string,
  params: Record<string, string> = {},
  auth?: TflAuth,
): Promise<T> {
  const query = new URLSearchParams({ ...params, ...authQuery(auth) })
  const url = `${TFL_BASE}${path}?${query}`
  const response = await fetch(url)
  if (!response.ok) {
    const body = (await response.text()).slice(0, 300)
    throw new Error(`TfL HTTP ${response.status}: ${body}`)
  }
  return response.json() as Promise<T>
}
