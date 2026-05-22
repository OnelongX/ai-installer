import path from 'node:path'

interface BuildSettingsJsonOptions {
  baseUrl?: string
  mode: 'custom' | 'official'
}

interface EnsureSettingsJsonDeps {
  fileExists(path: string): Promise<boolean>
  mkdir(path: string): Promise<void>
  userProfile: string
  writeFile(path: string, value: string): Promise<void>
}

// 2026-05 model lineup as shown in the Claude Code /model picker:
//   Opus 4.7   = claude-opus-4-7
//   Opus 4.7 1M = claude-opus-4-7-1m
//   Sonnet 4.6 = claude-sonnet-4-6      ← default (balanced cost/quality)
//   Haiku 4.5  = claude-haiku-4-5       ← fast/cheap small model
//   Opus 4.6   = claude-opus-4-6        (legacy)
const DEFAULT_MODEL = 'claude-sonnet-4-6'
const SMALL_FAST_MODEL = 'claude-haiku-4-5'
const DEFAULT_EFFORT = 'high'
const DEFAULT_BASE_URL = 'https://livetoken.top'

// Claude Code reads settings.json from %USERPROFILE%\.claude\settings.json on
// Windows (and ~/.claude/settings.json elsewhere). The schema accepts:
//   - env: a map of env vars injected into every claude session (we use this
//     to redirect the SDK at the LiveToken Anthropic-compatible endpoint and
//     to lock in the default model).
//   - model: default model name the CLI selects on startup.
//   - effortLevel: low | medium | high | xhigh | max.
//   - permissions / mcpServers / hooks: untouched here; users can layer them
//     on top without conflict.
function buildDefaultSettings(baseUrl: string) {
  return {
    env: {
      ANTHROPIC_BASE_URL: baseUrl,
      ANTHROPIC_MODEL: DEFAULT_MODEL,
      // Note: ANTHROPIC_SMALL_FAST_MODEL is marked [DEPRECATED] in the
      // official env-vars doc as of 2026-05, but Claude Code 2.1.x still
      // honors it. We keep it pinned to Haiku so background tasks don't
      // silently use Opus and burn tokens.
      ANTHROPIC_SMALL_FAST_MODEL: SMALL_FAST_MODEL,
      // Disable updater/telemetry/feedback/error reporting in one flag.
      // Docs: https://code.claude.com/docs/en/env-vars
      CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1',
      // Claude Code 2.1.36+ injects an `x-anthropic-billing-header` system
      // block whose `cch` field rotates per request. Anthropic's own backend
      // strips it before computing the prefix-cache key, but every third
      // party Anthropic-compatible gateway (LiveToken, Bedrock, vLLM, etc.)
      // treats it as part of the system prompt — so prefix-cache hit rate
      // crashes to zero and token spend balloons. Disabling the header here
      // restores cache hits for users routed through LiveToken.
      // Docs: https://code.claude.com/docs/en/llm-gateway
      CLAUDE_CODE_ATTRIBUTION_HEADER: '0'
    },
    model: DEFAULT_MODEL,
    effortLevel: DEFAULT_EFFORT,
    permissions: {
      defaultMode: 'acceptEdits'
    },
    autoUpdaterStatus: 'enabled',
    includeCoAuthoredBy: false
  }
}

export function buildSettingsJson(options: BuildSettingsJsonOptions) {
  const baseUrl = options.baseUrl ?? DEFAULT_BASE_URL
  return `${JSON.stringify(buildDefaultSettings(baseUrl), null, 2)}\n`
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
  await deps.writeFile(settingsPath, buildSettingsJson({ mode: 'official' }))

  return {
    created: true,
    path: settingsPath
  }
}
