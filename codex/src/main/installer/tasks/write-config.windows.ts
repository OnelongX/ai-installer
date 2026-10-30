// Windows-only module: always build Windows paths, so behaviour (and the unit
// tests, which CI runs on Linux) is the same on every OS.
import { win32 as path } from 'node:path'

import { DEFAULT_MODEL } from '../../../shared/models'
import {
  DEFAULT_PROVIDER,
  resolveProvider,
  type NetworkMode,
  type ProviderId,
  type ResolvedProvider
} from '../../../shared/provider-config'
import { mergeConfigToml, parseTomlTables } from './merge-config'

interface BuildConfigTomlOptions {
  /** Fully-resolved provider (base_url, name, env_key). Wins over provider/networkMode. */
  provider?: ResolvedProvider
  /** Or pass provider id + network mode and let this resolve it. */
  providerId?: ProviderId
  networkMode?: NetworkMode
  internalReachable?: boolean
  /** model id written to `model` + `review_model` (default: gpt-5.5) */
  model?: string
  /** absolute path to models-catalog.json; when set, emits model_catalog_json */
  catalogPath?: string
}

const DESKTOP_DETAIL_MODE_LINE = 'conversationDetailMode = "STEPS_COMMANDS"'
const INSTALLER_PROVIDER_TABLE = 'model_providers.cm'

// Keys that decide which gateway Codex talks to and how it authenticates. This
// is all 切换网关 writes; a switch must not reset the user's own preferences.
function gatewayRootLines(model: string, catalogPath?: string) {
  return [
    `model = "${model}"`,
    'model_provider = "cm"',
    // Point Codex at the generated catalog so its /model picker lists every
    // gateway model (GPT / Claude / DeepSeek / Kimi), not just OpenAI built-ins.
    // TOML literal string (single quotes) — no backslash escaping needed.
    ...(catalogPath ? [`model_catalog_json = '${catalogPath}'`] : []),
    // Force API-key auth for the custom provider. Without it Codex falls back to
    // ChatGPT login and never uses env_key. (The older preferred_auth_method key
    // is no longer recognised: Codex 0.15x warns that it "is ignored".)
    'forced_login_method = "api"',
    `review_model = "${model}"`
  ]
}

function gatewayTableLines(provider: ResolvedProvider) {
  return [
    // Only ModelProviderInfo fields: anything else here (approval_policy,
    // sandbox_mode, …) makes Codex warn "is ignored" on every run.
    `[${INSTALLER_PROVIDER_TABLE}]`,
    `name = "${provider.name}"`,
    `base_url = "${provider.baseUrl}"`,
    'wire_api = "responses"',
    `env_key = "${provider.envKey}"`,
    '',
    '[desktop]',
    // Codex desktop's STEPS_PROSE / Work mode requires a signed-in ChatGPT
    // account and blocks sends for api-key users; pin the commands view.
    DESKTOP_DETAIL_MODE_LINE
  ]
}

// Defaults written on a fresh install only. No service_tier: "fast" maps to the
// priority tier, which the gateway catalog doesn't advertise, so Codex warned
// and dropped it — and it would override the user's own choice.
const preferenceLines = [
  'model_reasoning_effort = "high"',
  'plan_mode_reasoning_effort = "xhigh"',
  'model_reasoning_summary = "detailed"',
  'model_verbosity = "medium"',
  'approval_policy = "on-request"',
  'allow_login_shell = true',
  'sandbox_mode = "workspace-write"',
  'cli_auth_credentials_store = "file"',
  'chatgpt_base_url = "https://chatgpt.com/backend-api/"',
  'mcp_oauth_credentials_store = "auto"',
  'check_for_update_on_startup = true',
  'web_search = "live"',
  'approvals_reviewer = "user"'
]

function renderConfigToml(provider: ResolvedProvider, model: string, catalogPath?: string) {
  return [
    'personality = "pragmatic"',
    ...gatewayRootLines(model, catalogPath),
    ...preferenceLines,
    '',
    ...gatewayTableLines(provider)
  ].join('\n')
}

function resolveOptions(options: BuildConfigTomlOptions) {
  return (
    options.provider ??
    resolveProvider(
      options.providerId ?? DEFAULT_PROVIDER,
      options.networkMode ?? 'auto',
      options.internalReachable ?? false
    )
  )
}

/**
 * Only the gateway-related keys, for 切换网关: merged into the existing file
 * this changes the gateway / key / model and leaves reasoning effort, sandbox,
 * approval policy, personality etc. exactly as the user set them.
 */
export function buildGatewayConfigToml(options: BuildConfigTomlOptions = {}) {
  return [
    ...gatewayRootLines(options.model ?? DEFAULT_MODEL, options.catalogPath),
    '',
    ...gatewayTableLines(resolveOptions(options))
  ].join('\n')
}

/**
 * Merge a freshly rendered config into the user's existing config.toml so a
 * reinstall only touches installer-owned keys: mcp_servers, plugins, projects,
 * other [desktop] keys etc. survive. [model_providers.cm] is owned outright.
 */
export function mergeInstallerConfig(rendered: string, existing: string | null | undefined) {
  return mergeConfigToml(rendered, existing, { replaceTables: [INSTALLER_PROVIDER_TABLE] })
}

export function getConfigBackupPath(configPath: string, now = new Date()) {
  return `${configPath}.bak-installer-${now.toISOString().replace(/[:.]/g, '-')}`
}

export function buildConfigToml(options: BuildConfigTomlOptions = {}) {
  return renderConfigToml(resolveOptions(options), options.model ?? DEFAULT_MODEL, options.catalogPath)
}

export function getConfigTomlPath(userProfile: string) {
  return path.join(userProfile, '.codex', 'config.toml')
}

export function getModelCatalogPath(userProfile: string) {
  return path.join(userProfile, '.codex', 'models-catalog.json')
}

/** Value of a single-line TOML string (`'literal'` or `"basic"`), else null. */
function readTomlString(line: string) {
  const value = line.slice(line.indexOf('=') + 1).trim()
  if (value.startsWith("'")) {
    const end = value.indexOf("'", 1)
    return end > 0 ? value.slice(1, end) : null
  }
  const basic = /^"((?:[^"\\]|\\.)*)"/.exec(value)
  if (!basic) {
    return null
  }
  try {
    return JSON.parse(`"${basic[1]}"`) as string
  } catch {
    return null
  }
}

export type CatalogWiring = 'wired' | 'no-gateway' | 'no-catalog'

/**
 * Does config.toml make Codex use the installer's gateway *and* read the given
 * models-catalog.json? Only then does refreshing that file change Codex's
 * /model list — a ChatGPT-login config (no model_provider = "cm") shows
 * OpenAI's own models no matter what the catalog contains.
 */
export function getCatalogWiring(configToml: string | null | undefined, catalogPath: string): CatalogWiring {
  const root = configToml ? parseTomlTables(configToml)[0] : undefined
  const rootValue = (key: string) => {
    const entry = root?.entries.find((candidate) => candidate.key === key)
    return entry ? readTomlString(entry.lines[0]) : null
  }

  if (rootValue('model_provider') !== 'cm') {
    return 'no-gateway'
  }
  const configured = rootValue('model_catalog_json')
  const normalize = (value: string) => path.normalize(value).toLowerCase()
  return configured && normalize(configured) === normalize(catalogPath) ? 'wired' : 'no-catalog'
}
