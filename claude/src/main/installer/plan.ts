import type { ApiKeyMode } from '../../shared/installer'

export interface InstallPlanInput {
  apiKeyMode: ApiKeyMode
  claudeInstalled: boolean
  nodeInstalled: boolean
  oauthCredentialsExist?: boolean
}

export interface InstallPlan {
  summary: string
  tasks: string[]
}

export function buildInstallPlan(input: InstallPlanInput): InstallPlan {
  const tasks: string[] = []

  if (!input.nodeInstalled) {
    tasks.push('install-node')
  }

  if (!input.claudeInstalled) {
    tasks.push('install-claude')
  }

  if (input.apiKeyMode === 'user-env') {
    tasks.push('persist-anthropic-api-key')
  }

  // Existing Anthropic OAuth credentials (from a previous `claude login`)
  // override ANTHROPIC_AUTH_TOKEN + ANTHROPIC_BASE_URL at runtime, so we must
  // clear them before write-config or the gateway override silently fails.
  if (input.oauthCredentialsExist) {
    tasks.push('clear-anthropic-oauth')
  }

  // Validate the gateway serves our models before writing anything, then
  // write the CLI settings.json and the Claude Desktop registry managed config.
  tasks.push(
    'verify-gateway',
    'write-config',
    'write-desktop-registry',
    'verify-claude-runtime'
  )

  return {
    summary: '在这台电脑上安装 Claude',
    tasks
  }
}
