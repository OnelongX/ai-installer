// Model-provider catalog for the Codex installer.
//
// One provider is offered:
//   - solaeon : the SolaEon deployment, reachable at two addresses —
//       internal (LAN): http://192.168.1.101:48760
//       external (WAN): https://ai-api.solaeon.com
//     The right one is chosen by NetworkMode; in `auto` mode the installer
//     probes the LAN address and falls back to the WAN address.
//
// ProviderId stays a named type rather than collapsing into a bare string:
// the choice is threaded through the IPC contract, saved gateway profiles and
// the config writers, so keeping it makes adding a second gateway a local
// change again. (LiveToken was offered here until it went offline.)

export type ProviderId = 'solaeon'

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

export const DEFAULT_PROVIDER: ProviderId = 'solaeon'

export function isProviderId(value: string): value is ProviderId {
  return value === 'solaeon'
}

export function isNetworkMode(value: string): value is NetworkMode {
  return value === 'auto' || value === 'internal' || value === 'external'
}

/**
 * Resolve a concrete base_url for the chosen provider.
 *
 * @param providerId       which provider the user picked
 * @param networkMode      auto | internal | external
 * @param internalReachable result of the LAN probe (only used when networkMode==='auto')
 */
export function resolveProvider(
  providerId: ProviderId = DEFAULT_PROVIDER,
  networkMode: NetworkMode = 'auto',
  internalReachable = false
): ResolvedProvider {
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
    id: providerId,
    name: 'Solaeon',
    baseUrl: solaeonEndpoints[network],
    envKey: 'OPENAI_API_KEY',
    network
  }
}
