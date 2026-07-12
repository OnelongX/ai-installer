import { baseModelIds, type ResolvedProvider } from '../../../shared/provider-config'

// Before writing any config we hit the gateway's /v1/models endpoint and make
// sure it actually serves the models we're about to whitelist. This catches a
// wrong base_url, a dead gateway, or a key that can't list models — failing
// loudly instead of leaving Claude with a config that points nowhere.

export interface GatewayCheckResult {
  ok: boolean
  /** model IDs the gateway reported */
  discovered: string[]
  /** required IDs the gateway did NOT report */
  missing: string[]
  /** populated when the request itself failed */
  error?: string
}

interface FetchLike {
  (url: string, init: { headers: Record<string, string>; signal?: AbortSignal }): Promise<{
    ok: boolean
    status: number
    text(): Promise<string>
  }>
}

function extractModelIds(raw: string): string[] {
  try {
    const doc = JSON.parse(raw) as unknown
    const list = Array.isArray(doc)
      ? doc
      : doc && typeof doc === 'object' && Array.isArray((doc as { data?: unknown[] }).data)
        ? (doc as { data: unknown[] }).data
        : []
    return list
      .map((entry) =>
        entry && typeof entry === 'object' ? String((entry as { id?: unknown }).id ?? '') : ''
      )
      .filter((id) => id.length > 0)
  } catch {
    return []
  }
}

/**
 * @param provider   resolved provider (base URL)
 * @param apiKey     Bearer token
 * @param fetchImpl  injectable fetch (defaults to global fetch), for testing
 * @param timeoutMs  request timeout
 */
export async function checkGatewayModels(
  provider: ResolvedProvider,
  apiKey: string,
  fetchImpl: FetchLike = globalThis.fetch as unknown as FetchLike,
  timeoutMs = 15_000
): Promise<GatewayCheckResult> {
  const url = `${provider.baseUrl.replace(/\/$/, '')}/v1/models`
  const required = baseModelIds()

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetchImpl(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'anthropic-version': '2023-06-01'
      },
      signal: controller.signal
    })

    if (!response.ok) {
      return {
        ok: false,
        discovered: [],
        missing: required,
        error: `${provider.baseUrl}/v1/models returned HTTP ${response.status}`
      }
    }

    const discovered = extractModelIds(await response.text())
    const missing = required.filter((id) => !discovered.includes(id))

    return {
      ok: missing.length === 0,
      discovered,
      missing
    }
  } catch (error) {
    return {
      ok: false,
      discovered: [],
      missing: required,
      error: error instanceof Error ? error.message : String(error)
    }
  } finally {
    clearTimeout(timer)
  }
}
