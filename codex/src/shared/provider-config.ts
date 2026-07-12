// Model-provider catalog for the Codex installer.
//
// Two providers are offered:
//   - livetoken : the default public gateway (https://livetoken.top/v1)
//   - solaeon   : an internal deployment reachable at two addresses —
//       internal (LAN): http://192.168.1.101:48760
//       external (WAN): https://ai-api.solaeon.com
//     The right one is chosen by NetworkMode; in `auto` mode the installer
//     probes the LAN address and falls back to the WAN address.

export type ProviderId = 'livetoken' | 'solaeon'

export type NetworkMode = 'auto' | 'internal' | 'external'

export interface ResolvedProvider {
  id: ProviderId
  /** value written to `name = "…"` inside [model_providers.cm] */
  name: string
  /** value written to `base_url = "…"` (no trailing slash) */
  baseUrl: string
  /** value written to `env_key = "…"` */
  envKey: string
  /** which physical address the base_url points at (solaeon only) */
  network?: 'internal' | 'external'
}

export const solaeonEndpoints = {
  internal: 'http://192.168.1.101:48760',
  external: 'https://ai-api.solaeon.com'
} as const

const LIVETOKEN: ResolvedProvider = {
  id: 'livetoken',
  name: 'LiveToken',
  baseUrl: 'https://livetoken.top/v1',
  envKey: 'OPENAI_API_KEY'
}

export const DEFAULT_PROVIDER: ProviderId = 'livetoken'

export function isProviderId(value: string): value is ProviderId {
  return value === 'livetoken' || value === 'solaeon'
}

export function isNetworkMode(value: string): value is NetworkMode {
  return value === 'auto' || value === 'internal' || value === 'external'
}

/**
 * Resolve a concrete base_url for the chosen provider.
 *
 * @param providerId       which provider the user picked
 * @param networkMode      auto | internal | external (only used for solaeon)
 * @param internalReachable result of the LAN probe (only used when networkMode==='auto')
 */
export function resolveProvider(
  providerId: ProviderId,
  networkMode: NetworkMode = 'auto',
  internalReachable = false
): ResolvedProvider {
  if (providerId === 'livetoken') {
    return { ...LIVETOKEN }
  }

  let network: 'internal' | 'external'

  if (networkMode === 'internal') {
    network = 'internal'
  } else if (networkMode === 'external') {
    network = 'external'
  } else {
    // auto: prefer LAN when the probe says it's reachable
    network = internalReachable ? 'internal' : 'external'
  }

  return {
    id: 'solaeon',
    name: 'Solaeon',
    baseUrl: solaeonEndpoints[network],
    envKey: 'OPENAI_API_KEY',
    network
  }
}
