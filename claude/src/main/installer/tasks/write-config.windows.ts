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

const DEFAULT_MODEL = 'claude-sonnet-4-5'
const DEFAULT_BASE_URL = 'https://livetoken.top'

// Claude Code reads settings.json from %USERPROFILE%\.claude\settings.json on
// Windows (and ~/.claude/settings.json elsewhere). The schema accepts:
//   - env: a map of env vars injected into every claude session (we use this
//     to redirect the SDK at the LiveToken Anthropic-compatible endpoint and
//     to lock in the default model).
//   - model: default model name the CLI selects on startup.
//   - permissions / mcpServers / hooks: untouched here; users can layer them
//     on top without conflict.
function buildDefaultSettings(baseUrl: string) {
  return {
    env: {
      ANTHROPIC_BASE_URL: baseUrl,
      ANTHROPIC_MODEL: DEFAULT_MODEL,
      ANTHROPIC_SMALL_FAST_MODEL: DEFAULT_MODEL,
      CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '0',
      // Claude Code 2.1.36+ injects an `x-anthropic-billing-header` system
      // block whose `cch` field rotates per request. Anthropic's own backend
      // strips it before computing the prefix-cache key, but every third
      // party Anthropic-compatible gateway (LiveToken, Bedrock, vLLM, etc.)
      // treats it as part of the system prompt — so prefix-cache hit rate
      // crashes to zero and token spend balloons. Disabling the header here
      // restores cache hits for users routed through LiveToken.
      CLAUDE_CODE_ATTRIBUTION_HEADER: '0'
    },
    model: DEFAULT_MODEL,
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
