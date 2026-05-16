import path from 'node:path'

interface BuildConfigTomlOptions {
  baseUrl?: string
  mode: 'custom' | 'official'
}

interface EnsureConfigTomlDeps {
  fileExists(path: string): Promise<boolean>
  mkdir(path: string): Promise<void>
  userProfile: string
  writeFile(path: string, value: string): Promise<void>
}

const defaultConfigToml = [
  'personality = "pragmatic"',
  'model = "gpt-5.5"',
  'model_provider = "cm"',
  'review_model = "gpt-5.5"',
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
  'name = "LiveToken"',
  'base_url = "https://livetoken.top/v1"',
  'wire_api = "responses"',
  'env_key = "OPENAI_API_KEY"'
].join('\n')

export function buildConfigToml(_options: BuildConfigTomlOptions) {
  return defaultConfigToml
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
  await deps.writeFile(configPath, buildConfigToml({ mode: 'official' }))

  return {
    created: true,
    path: configPath
  }
}
