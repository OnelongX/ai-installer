// Model-provider catalog for the Claude installer.
//
// Two Anthropic-compatible gateways are offered:
//   - solaeon   : https://ai-api.solaeon.com   (default)
//   - livetoken : https://livetoken.top
//
// Both serve the standard Anthropic model IDs, so they share one model
// catalog and differ only in base_url. Auth is always a Bearer token
// (ANTHROPIC_AUTH_TOKEN), which is the gateway path the official Claude Code
// docs recommend.
//
// IMPORTANT: base_url must be HTTPS. Claude Code and Claude Desktop reject a
// plain http:// gateway, so there is no LAN/http option here (unlike Codex,
// which is OpenAI-compatible and accepts the http://192.168.1.101:48760 box).

export type ProviderId = 'solaeon' | 'livetoken'

export const DEFAULT_PROVIDER: ProviderId = 'solaeon'

export interface ClaudeModel {
  /** model id sent to the gateway and written to availableModels */
  name: string
  /** human label shown in the Claude Desktop picker */
  labelOverride: string
  /** anthropic tier bucket: sonnet | opus | haiku | fable */
  anthropicFamilyTier: string
  /** whether this is the default pick for its tier */
  isFamilyDefault?: boolean
  /** whether Claude Desktop should generate a "… 1M" context variant */
  supports1m?: boolean
}

// 2026-05 SolaEon / Anthropic catalog — 7 base models, three of which get a
// 1M-context menu entry (sonnet-5, opus-4-8, fable-5). Order is significant:
// the Desktop picker renders them in this order.
export const claudeModels: ClaudeModel[] = [
  {
    name: 'claude-sonnet-5',
    labelOverride: 'Claude Sonnet 5',
    anthropicFamilyTier: 'sonnet',
    isFamilyDefault: true,
    supports1m: true
  },
  {
    name: 'claude-opus-4-8',
    labelOverride: 'Claude Opus 4.8',
    anthropicFamilyTier: 'opus',
    isFamilyDefault: true,
    supports1m: true
  },
  {
    name: 'claude-haiku-4-5',
    labelOverride: 'Claude Haiku 4.5',
    anthropicFamilyTier: 'haiku',
    isFamilyDefault: true
  },
  {
    name: 'claude-sonnet-4-6',
    labelOverride: 'Claude Sonnet 4.6',
    anthropicFamilyTier: 'sonnet'
  },
  {
    name: 'claude-opus-4-7',
    labelOverride: 'Claude Opus 4.7',
    anthropicFamilyTier: 'opus'
  },
  {
    name: 'claude-opus-4-6',
    labelOverride: 'Claude Opus 4.6',
    anthropicFamilyTier: 'opus'
  },
  {
    name: 'claude-fable-5',
    labelOverride: 'Claude Fable 5',
    anthropicFamilyTier: 'fable',
    isFamilyDefault: true,
    supports1m: true
  }
]

/** default model the CLI + Desktop select on startup */
export const DEFAULT_MODEL = 'claude-opus-4-8'
/** tier defaults written to ANTHROPIC_DEFAULT_*_MODEL */
export const TIER_DEFAULTS = {
  opus: 'claude-opus-4-8',
  sonnet: 'claude-sonnet-5',
  haiku: 'claude-haiku-4-5'
} as const

export interface ResolvedProvider {
  id: ProviderId
  /** display name (used in UI / logs) */
  name: string
  /** gateway base URL, no trailing slash, no /v1 */
  baseUrl: string
}

const PROVIDERS: Record<ProviderId, ResolvedProvider> = {
  solaeon: {
    id: 'solaeon',
    name: 'SolaEon',
    baseUrl: 'https://ai-api.solaeon.com'
  },
  livetoken: {
    id: 'livetoken',
    name: 'LiveToken',
    baseUrl: 'https://livetoken.top'
  }
}

export function isProviderId(value: string): value is ProviderId {
  return value === 'solaeon' || value === 'livetoken'
}

export function resolveProvider(providerId: ProviderId = DEFAULT_PROVIDER): ResolvedProvider {
  return { ...PROVIDERS[providerId] }
}

/** model IDs allowed in settings.json availableModels (base models only, no 1M suffix) */
export function baseModelIds(): string[] {
  return claudeModels.map((m) => m.name)
}

/** the three IDs that get a 1M Desktop variant */
export function oneMillionModelIds(): string[] {
  return claudeModels.filter((m) => m.supports1m).map((m) => m.name)
}
