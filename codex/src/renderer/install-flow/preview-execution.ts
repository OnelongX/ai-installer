import type { InstallPlan } from '../../main/installer/plan'
import { getInstallCodexWindowsCommand } from '../../main/installer/tasks/install-codex.windows'
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
    case 'install-codex':
      return commandToString(getInstallCodexWindowsCommand())
    case 'persist-openai-api-key':
      return '[Environment]::SetEnvironmentVariable("OPENAI_API_KEY", "***", "User")'
    case 'write-config':
      return 'Write %USERPROFILE%\\.codex\\config.toml'
    case 'verify-codex-runtime':
      return 'codex --version'
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
    configPath: 'C:\\Users\\Administrator\\.codex\\config.toml',
    keyMask: `sk-***${apiKey.slice(-4)}`,
    logs: plan.tasks.map(buildTaskLog),
    version: '0.1.0'
  }
}
