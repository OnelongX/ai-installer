import type { ApiKeyMode } from '../../shared/installer'

export interface InstallPlanInput {
  apiKeyMode: ApiKeyMode
  claudeInstalled: boolean
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

  if (!input.claudeInstalled) {
    tasks.push('install-claude')
  }

  if (input.apiKeyMode === 'user-env') {
    tasks.push('persist-anthropic-api-key')
  }

  tasks.push('write-config', 'verify-claude-runtime')

  return {
    summary: '在这台电脑上安装 Claude',
    tasks
  }
}
