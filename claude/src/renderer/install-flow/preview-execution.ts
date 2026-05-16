import type { InstallPlan } from '../../main/installer/plan'
import { getInstallClaudeWindowsCommand } from '../../main/installer/tasks/install-claude.windows'
import { getInstallNodeWindowsCommand } from '../../main/installer/tasks/install-node.windows'

interface PreviewExecutionResult {
  configPath: string
  keyMask: string
  logs: string[]
  version: string
}

function commandToString(command: { command: string; args: string[] }) {
  return [command.command, ...command.args].join(' ')
}

function buildTaskLog(task: string) {
  switch (task) {
    case 'install-node':
      return commandToString(getInstallNodeWindowsCommand())
    case 'install-claude':
      return commandToString(getInstallClaudeWindowsCommand())
    case 'persist-anthropic-api-key':
      return '[Environment]::SetEnvironmentVariable("ANTHROPIC_API_KEY", "***", "User")'
    case 'write-config':
      return 'Write %USERPROFILE%\\.claude\\settings.json'
    case 'verify-claude-runtime':
      return 'claude --version'
    default:
      return task
  }
}

export async function runPreviewInstall(
  plan: InstallPlan,
  apiKey: string
): Promise<PreviewExecutionResult> {
  await Promise.resolve()

  return {
    configPath: 'C:\\Users\\Administrator\\.claude\\settings.json',
    keyMask: `sk-***${apiKey.slice(-4)}`,
    logs: plan.tasks.map(buildTaskLog),
    version: '0.1.0'
  }
}
