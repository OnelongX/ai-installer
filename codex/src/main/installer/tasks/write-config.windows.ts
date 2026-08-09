import path from 'node:path'

import { DEFAULT_MODEL } from '../../../shared/models'
import {
  resolveProvider,
  type NetworkMode,
  type ProviderId,
  type ResolvedProvider
} from '../../../shared/provider-config'

interface BuildConfigTomlOptions {
  /** Fully-resolved provider (base_url, name, env_key). Wins over provider/networkMode. */
  provider?: ResolvedProvider
  /** Or pass provider id + network mode and let this resolve it. */
  providerId?: ProviderId
  networkMode?: NetworkMode
  internalReachable?: boolean
  /** model id written to `model` + `review_model` (default: gpt-5.5) */
  model?: string
}

interface EnsureConfigTomlDeps {
  fileExists(path: string): Promise<boolean>
  mkdir(path: string): Promise<void>
  userProfile: string
  writeFile(path: string, value: string): Promise<void>
}

function renderConfigToml(provider: ResolvedProvider, model: string) {
  return [
    'personality = "pragmatic"',
    `model = "${model}"`,
    'model_provider = "cm"',
    // Force API-key auth for the custom provider. Without these Codex falls back
    // to ChatGPT login and never uses env_key (per DeepSeek's Codex doc). Needed
    // for any api-key gateway (SolaEon / LiveToken / DeepSeek passthrough).
    'preferred_auth_method = "apikey"',
    'forced_login_method = "api"',
    `review_model = "${model}"`,
    'model_reasoning_effort = "high"',
    'plan_mode_reasoning_effort = "xhigh"',
    'model_reasoning_summary = "detailed"',
    'model_verbosity = "medium"',
    'model_supports_reasoning_summaries = true',
    'approval_policy = "on-request"',
    'allow_login_shell = true',
    'sandbox_mode = "workspace-write"',
    'cli_auth_credentials_store = "file"',
    'chatgpt_base_url = "https://chatgpt.com/backend-api/"',
    'mcp_oauth_credentials_store = "auto"',
    'check_for_update_on_startup = true',
    'web_search = "live"',
    'approvals_reviewer = "user"',
    'service_tier = "fast"',
    '',
    '[model_providers.cm]',
    'approval_policy = "on-request"',
    'sandbox_mode = "workspace-write"',
    'web_search = "live"',
    `name = "${provider.name}"`,
    `base_url = "${provider.baseUrl}"`,
    'wire_api = "responses"',
    `env_key = "${provider.envKey}"`
  ].join('\n')
}

export function buildConfigToml(options: BuildConfigTomlOptions = {}) {
  const provider =
    options.provider ??
    resolveProvider(
      options.providerId ?? 'livetoken',
      options.networkMode ?? 'auto',
      options.internalReachable ?? false
    )

  return renderConfigToml(provider, options.model ?? DEFAULT_MODEL)
}

export function getConfigTomlPath(userProfile: string) {
  return path.join(userProfile, '.codex', 'config.toml')
}

export async function ensureConfigToml(deps: EnsureConfigTomlDeps) {
  const configPath = getConfigTomlPath(deps.userProfile)

  if (await deps.fileExists(configPath)) {
    return {
      created: false,
      path: configPath
    }
  }

  await deps.mkdir(path.dirname(configPath))
  // Bootstrap default is the public LiveToken gateway; the real install run
  // (service.startInstall) rewrites this with the user's chosen provider.
  await deps.writeFile(configPath, buildConfigToml())

  return {
    created: true,
    path: configPath
  }
}
