import type { ApiKeyMode } from '../../shared/installer'

export interface InstallPlanInput {
  apiKeyMode: ApiKeyMode
  codexInstalled: boolean
  nodeInstalled: boolean
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

  if (!input.codexInstalled) {
    tasks.push('install-codex')
  }

  if (input.apiKeyMode === 'user-env') {
    tasks.push('persist-openai-api-key')
  }

  // Validate the gateway is reachable before writing config.toml.
  tasks.push('verify-gateway', 'write-config', 'verify-codex-runtime')

  return {
    summary: '在这台电脑上安装 Codex',
    tasks
  }
}
