import { runCommand } from '../../system/exec'
import type { DetectionItem, DetectionStatus } from './detection-types'

const detectNodeCommand = 'node -v'

export function classifyNodeState(version: string | null): DetectionStatus {
  return version ? 'satisfied' : 'auto-fixable'
}

export async function detectNode(): Promise<DetectionItem> {
  try {
    const result = await runCommand('node', ['-v'])
    const version = result.exitCode === 0 ? result.stdout.trim() : null

    return {
      command: detectNodeCommand,
      detail: version ? `\u5df2\u68c0\u6d4b\u5230 ${version}` : '\u672a\u68c0\u6d4b\u5230 Node.js',
      id: 'node',
      observedOutput: version ?? undefined,
      status: classifyNodeState(version),
      title: 'Node.js'
    }
  } catch (error) {
    return {
      command: detectNodeCommand,
      detail: '\u672a\u68c0\u6d4b\u5230 Node.js',
      id: 'node',
      observedOutput: error instanceof Error ? error.message : undefined,
      status: 'auto-fixable',
      title: 'Node.js'
    }
  }
}
