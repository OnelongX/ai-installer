import path from 'node:path'

// Gemini CLI (0.6x) reads ~/.gemini/settings.json in its nested "v2" shape:
//   { "security": { "auth": { "selectedType": "gemini-api-key" } },
//     "model": { "name": "gemini-3-pro" } }
// plus GEMINI_API_KEY / GOOGLE_GEMINI_BASE_URL from the environment. With
// selectedType = gemini-api-key the CLI skips Google OAuth and sends requests to
// GOOGLE_GEMINI_BASE_URL. ("gateway" is an internal auth type the CLI derives
// from the env var; it is rejected as a settings value.)
//
// Only those two settings are owned here; mcpServers, theme, etc. are kept.

export const GEMINI_AUTH_TYPE = 'gemini-api-key'

export function getGeminiSettingsPath(userProfile: string) {
  return path.join(userProfile, '.gemini', 'settings.json')
}

type JsonObject = Record<string, unknown>

const isObject = (value: unknown): value is JsonObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/**
 * Merge our auth + model into an existing settings.json. Throws on a file that
 * isn't a JSON object, so a hand-edited file is never silently replaced.
 */
export function mergeGeminiSettings(existing: string | null | undefined, model: string) {
  let settings: JsonObject = {}
  if (existing?.trim()) {
    const parsed: unknown = JSON.parse(existing)
    if (!isObject(parsed)) {
      throw new Error('settings.json 不是 JSON 对象')
    }
    settings = parsed
  }

  // Legacy flat keys written by the old configure-gemini-cli scripts; current
  // CLIs expect the nested shape and a string `model` would clash with it.
  const { selectedAuthType: _legacyAuth, ...rest } = settings
  const security = isObject(rest.security) ? rest.security : {}
  const auth = isObject(security.auth) ? security.auth : {}
  const modelSettings = isObject(rest.model) ? rest.model : {}

  return JSON.stringify(
    {
      ...rest,
      security: { ...security, auth: { ...auth, selectedType: GEMINI_AUTH_TYPE } },
      model: { ...modelSettings, name: model }
    },
    null,
    2
  )
}

function quotePowerShellSingle(value: string) {
  return `'${value.replace(/'/g, "''")}'`
}

/** Persist the Gemini CLI env vars for the current Windows user. */
export function buildPersistGeminiEnvCommand(apiKey: string, baseUrl: string) {
  return [
    `[Environment]::SetEnvironmentVariable('GEMINI_API_KEY', ${quotePowerShellSingle(apiKey)}, 'User')`,
    `[Environment]::SetEnvironmentVariable('GOOGLE_GEMINI_BASE_URL', ${quotePowerShellSingle(baseUrl)}, 'User')`
  ].join('; ')
}
