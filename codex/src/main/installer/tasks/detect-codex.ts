import { runCommand } from '../../system/exec'
import type { DetectionItem } from './detection-types'

const detectCodexCommand = 'codex --version'

export async function detectCodex(): Promise<DetectionItem> {
  try {
    const result = await runCommand('codex', ['--version'])
    const version = result.exitCode === 0 ? result.stdout.trim() : null

    if (version) {
      return {
        command: detectCodexCommand,
        detail: `\u5df2\u68c0\u6d4b\u5230 ${version}`,
        id: 'codex',
        observedOutput: version,
        status: 'satisfied',
        title: 'Codex CLI'
      }
    }
  } catch (error) {
    return {
      command: detectCodexCommand,
      detail: '\u672a\u5b89\u88c5 Codex CLI',
      id: 'codex',
      observedOutput: error instanceof Error ? error.message : undefined,
      status: 'auto-fixable',
      title: 'Codex CLI'
    }
  }

  return {
    command: detectCodexCommand,
    detail: '\u672a\u5b89\u88c5 Codex CLI',
    id: 'codex',
    status: 'auto-fixable',
    title: 'Codex CLI'
  }
}
