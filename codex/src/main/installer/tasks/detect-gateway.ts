import type { GatewayModel } from '../../../shared/models'
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

// Gateways disagree on the envelope. OpenAI-standard is `{data:[{id}]}`, but the
// SolaEon Codex gateway answers `{models:[{slug, display_name}]}`. Accept a bare
// array too. We read id-or-slug for the value and display_name/name/label for a
// human label, so both shapes populate the picker.
function extractModels(raw: string): GatewayModel[] {
  try {
    const doc = JSON.parse(raw) as unknown
    const container = doc as { data?: unknown[]; models?: unknown[] } | null
    const list = Array.isArray(doc)
      ? doc
      : container && Array.isArray(container.models)
        ? container.models
        : container && Array.isArray(container.data)
          ? container.data
          : []
    return list
      .map((entry): GatewayModel => {
        if (typeof entry === 'string') {
          return { id: entry, label: entry }
        }
        if (entry && typeof entry === 'object') {
          const record = entry as {
            id?: unknown
            slug?: unknown
            display_name?: unknown
            name?: unknown
            label?: unknown
          }
          const id = String(record.id ?? record.slug ?? '')
          const label = String(
            record.display_name ?? record.name ?? record.label ?? id
          )
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

function countModels(raw: string): number {
  return extractModelIds(raw).length
}

/**
 * Fetch the gateway's models (id + label) so the installer can populate its
 * model picker from /v1/models instead of a hardcoded list. Returns [] on any
 * failure — the renderer then keeps its built-in fallback list.
 */
export async function fetchGatewayModels(
  provider: ResolvedProvider,
  apiKey: string,
  fetchImpl: FetchLike = globalThis.fetch as unknown as FetchLike,
  timeoutMs = 15_000
): Promise<GatewayModel[]> {
  const url = modelsEndpoint(provider.baseUrl)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetchImpl(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
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

/** Id-only variant, kept for callers/tests that only need the identifiers. */
export async function fetchGatewayModelIds(
  provider: ResolvedProvider,
  apiKey: string,
  fetchImpl: FetchLike = globalThis.fetch as unknown as FetchLike,
  timeoutMs = 15_000
): Promise<string[]> {
  return (await fetchGatewayModels(provider, apiKey, fetchImpl, timeoutMs)).map(
    (model) => model.id
  )
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
