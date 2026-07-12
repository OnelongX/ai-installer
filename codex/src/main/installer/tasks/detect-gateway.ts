import type { ResolvedProvider } from '../../../shared/provider-config'

// Before writing config.toml we hit the gateway's /v1/models endpoint to make
// sure it's actually reachable with the given key. Unlike the Claude installer
// we don't assert specific model IDs — Codex/OpenAI-compatible gateways name
// models freely — we only require a successful, model-listing response so a
// wrong base_url / dead gateway / bad key fails loudly instead of leaving Codex
// pointed at nothing.

export interface GatewayCheckResult {
  ok: boolean
  /** number of models the gateway reported (0 if none / unparsable) */
  modelCount: number
  error?: string
}

interface FetchLike {
  (url: string, init: { headers: Record<string, string>; signal?: AbortSignal }): Promise<{
    ok: boolean
    status: number
    text(): Promise<string>
  }>
}

/** Normalise any base_url to `{root}/v1/models` (base may or may not carry /v1). */
export function modelsEndpoint(baseUrl: string): string {
  const root = baseUrl.replace(/\/+$/, '').replace(/\/v1$/i, '')
  return `${root}/v1/models`
}

function countModels(raw: string): number {
  try {
    const doc = JSON.parse(raw) as unknown
    const list = Array.isArray(doc)
      ? doc
      : doc && typeof doc === 'object' && Array.isArray((doc as { data?: unknown[] }).data)
        ? (doc as { data: unknown[] }).data
        : []
    return list.length
  } catch {
    return 0
  }
}

export async function checkGatewayReachable(
  provider: ResolvedProvider,
  apiKey: string,
  fetchImpl: FetchLike = globalThis.fetch as unknown as FetchLike,
  timeoutMs = 15_000
): Promise<GatewayCheckResult> {
  const url = modelsEndpoint(provider.baseUrl)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetchImpl(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: controller.signal
    })

    if (!response.ok) {
      return {
        ok: false,
        modelCount: 0,
        error: `${url} 返回 HTTP ${response.status}`
      }
    }

    const modelCount = countModels(await response.text())
    return { ok: true, modelCount }
  } catch (error) {
    return {
      ok: false,
      modelCount: 0,
      error: error instanceof Error ? error.message : String(error)
    }
  } finally {
    clearTimeout(timer)
  }
}
