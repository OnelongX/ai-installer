import type { GatewayModel } from '../../../shared/model-catalog'
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

function extractModels(raw: string): GatewayModel[] {
  try {
    const doc = JSON.parse(raw) as unknown
    const list = Array.isArray(doc)
      ? doc
      : doc && typeof doc === 'object' && Array.isArray((doc as { data?: unknown[] }).data)
        ? (doc as { data: unknown[] }).data
        : []
    return list
      .map((entry): GatewayModel => {
        if (entry && typeof entry === 'object') {
          const record = entry as { id?: unknown; display_name?: unknown; name?: unknown }
          const id = String(record.id ?? '')
          const label = String(record.display_name ?? record.name ?? id)
          return { id, label }
        }
        return { id: '', label: '' }
      })
      .filter((model) => model.id.length > 0)
  } catch {
    return []
  }
}

function extractModelIds(raw: string): string[] {
  return extractModels(raw).map((model) => model.id)
}

interface FetchResult {
  ok: boolean
  status: number
  text(): Promise<string>
}

/**
 * Fetch the gateway's models (id + display label) for a client-side refresh.
 * Returns [] on any failure (bad key, dead gateway, non-HTTPS) so the caller
 * can report a friendly error and leave the existing catalog untouched.
 */
export async function fetchClaudeModels(
  provider: ResolvedProvider,
  apiKey: string,
  fetchImpl: FetchLike = globalThis.fetch as unknown as FetchLike,
  timeoutMs = 15_000
): Promise<GatewayModel[]> {
  if (!/^https:\/\//i.test(provider.baseUrl)) {
    return []
  }
  const url = `${provider.baseUrl.replace(/\/$/, '')}/v1/models`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response: FetchResult = await fetchImpl(url, {
      headers: { Authorization: `Bearer ${apiKey}`, 'anthropic-version': '2023-06-01' },
      signal: controller.signal
    })
    if (!response.ok) {
      return []
    }
    return extractModels(await response.text())
  } catch {
    return []
  } finally {
    clearTimeout(timer)
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
  const required = baseModelIds()

  // Claude Code and Claude Desktop only accept HTTPS gateway URLs — a plain
  // http:// base_url is rejected by the client before any request is made.
  // Fail loudly here rather than writing a config Claude will silently ignore.
  if (!/^https:\/\//i.test(provider.baseUrl)) {
    return {
      ok: false,
      discovered: [],
      missing: required,
      error: `Claude 只支持 HTTPS 网关，但 ${provider.name} 的地址是 ${provider.baseUrl}`
    }
  }

  const url = `${provider.baseUrl.replace(/\/$/, '')}/v1/models`

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
