import path from 'node:path'

import {
  DEFAULT_MODEL,
  TIER_DEFAULTS,
  baseModelIds,
  resolveProvider,
  type ProviderId,
  type ResolvedProvider
} from '../../../shared/provider-config'

interface BuildSettingsJsonOptions {
  /** fully-resolved provider (base URL). Wins over providerId. */
  provider?: ResolvedProvider
  providerId?: ProviderId
  /** the LiveToken / SolaEon API key. Written as ANTHROPIC_AUTH_TOKEN (Bearer). */
  apiKey?: string
  /** override the availableModels whitelist (default: curated base ids) */
  availableModelIds?: string[]
}

interface EnsureSettingsJsonDeps {
  fileExists(path: string): Promise<boolean>
  mkdir(path: string): Promise<void>
  userProfile: string
  writeFile(path: string, value: string): Promise<void>
}

// Claude Code reads settings.json from %USERPROFILE%\.claude\settings.json.
// We follow the SolaEon reference layout:
//   env.ANTHROPIC_BASE_URL       → the gateway
//   env.ANTHROPIC_AUTH_TOKEN     → the key, sent as `Authorization: Bearer`
//                                  (the gateway-recommended auth per Claude docs)
//   env.ANTHROPIC_DEFAULT_*_MODEL→ per-tier default model
//   env.API_TIMEOUT_MS           → 5-minute request timeout for slow gateways
//   model                        → startup default (Opus 4.8)
//   availableModels              → the 7-model whitelist (base ids, no 1M suffix)
//
// We additionally keep CLAUDE_CODE_ATTRIBUTION_HEADER=0: Claude Code 2.1.36+
// prepends a per-request `cch` fingerprint to the system prompt that tanks a
// third-party gateway's prefix-cache hit rate. Anthropic's own backend strips
// it; gateways don't. Turning it off keeps caches hot.
// Docs: https://code.claude.com/docs/en/llm-gateway
function buildSettings(baseUrl: string, apiKey?: string, availableModelIds?: string[]) {
  const env: Record<string, string> = {
    ANTHROPIC_BASE_URL: baseUrl,
    ANTHROPIC_DEFAULT_OPUS_MODEL: TIER_DEFAULTS.opus,
    ANTHROPIC_DEFAULT_SONNET_MODEL: TIER_DEFAULTS.sonnet,
    ANTHROPIC_DEFAULT_HAIKU_MODEL: TIER_DEFAULTS.haiku,
    API_TIMEOUT_MS: '300000',
    CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1',
    CLAUDE_CODE_ATTRIBUTION_HEADER: '0'
  }

  if (apiKey) {
    env.ANTHROPIC_AUTH_TOKEN = apiKey
  }

  return {
    env,
    model: DEFAULT_MODEL,
    availableModels: availableModelIds ?? baseModelIds(),
    permissions: {
      defaultMode: 'acceptEdits'
    },
    autoUpdaterStatus: 'enabled',
    includeCoAuthoredBy: false
  }
}

export function buildSettingsJson(options: BuildSettingsJsonOptions = {}) {
  const provider = options.provider ?? resolveProvider(options.providerId)
  return `${JSON.stringify(buildSettings(provider.baseUrl, options.apiKey, options.availableModelIds), null, 2)}\n`
}

/**
 * Update an existing settings.json's `availableModels` in place, preserving
 * everything else (auth token, env, permissions, user customisations). Used by
 * the client-side model refresh so we never clobber the user's key. Falls back
 * to a full rebuild only when the existing file can't be parsed.
 */
export function updateAvailableModels(
  rawSettings: string,
  modelIds: string[],
  fallback: BuildSettingsJsonOptions = {}
): string {
  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(rawSettings) as Record<string, unknown>
    if (!parsed || typeof parsed !== 'object') {
      throw new Error('not an object')
    }
  } catch {
    return buildSettingsJson({ ...fallback, availableModelIds: modelIds })
  }
  parsed.availableModels = modelIds
  // Keep the startup default valid — if it's no longer offered, fall back.
  if (typeof parsed.model === 'string' && !modelIds.includes(parsed.model)) {
    parsed.model = modelIds.includes(DEFAULT_MODEL) ? DEFAULT_MODEL : modelIds[0]
  }
  return `${JSON.stringify(parsed, null, 2)}\n`
}

export function getSettingsJsonPath(userProfile: string) {
  return path.join(userProfile, '.claude', 'settings.json')
}

export async function ensureSettingsJson(deps: EnsureSettingsJsonDeps) {
  const settingsPath = getSettingsJsonPath(deps.userProfile)

  if (await deps.fileExists(settingsPath)) {
    return {
      created: false,
      path: settingsPath
    }
  }

  await deps.mkdir(path.dirname(settingsPath))
  // Bootstrap default has no key yet (SolaEon gateway); the real install run
  // rewrites this with the resolved provider + ANTHROPIC_AUTH_TOKEN.
  await deps.writeFile(settingsPath, buildSettingsJson())

  return {
    created: true,
    path: settingsPath
  }
}
