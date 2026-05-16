import { runCommand } from '../../system/exec'
import type { DetectionItem } from './detection-types'

const detectClaudeCommand = 'claude --version'

export async function detectClaude(): Promise<DetectionItem> {
  try {
    const result = await runCommand('claude', ['--version'])
    const version = result.exitCode === 0 ? result.stdout.trim() : null

    if (version) {
      return {
        command: detectClaudeCommand,
        detail: `\u5df2\u68c0\u6d4b\u5230 ${version}`,
        id: 'claude',
        observedOutput: version,
        status: 'satisfied',
        title: 'Claude Code CLI'
      }
    }
  } catch (error) {
    return {
      command: detectClaudeCommand,
      detail: '\u672a\u5b89\u88c5 Claude Code CLI',
      id: 'claude',
      observedOutput: error instanceof Error ? error.message : undefined,
      status: 'auto-fixable',
      title: 'Claude Code CLI'
    }
  }

  return {
    command: detectClaudeCommand,
    detail: '\u672a\u5b89\u88c5 Claude Code CLI',
    id: 'claude',
    status: 'auto-fixable',
    title: 'Claude Code CLI'
  }
}
