import { beforeEach, describe, expect, it, vi } from 'vitest'

const runCommandMock = vi.fn()

vi.mock('../../src/main/system/exec', () => ({
  runCommand: (...args: unknown[]) => runCommandMock(...args)
}))

import { classifyNodeState, detectNode } from '../../src/main/installer/tasks/detect-node'

describe('node detection', () => {
  beforeEach(() => {
    runCommandMock.mockReset()
  })

  it('marks a missing installation as auto-fixable', () => {
    expect(classifyNodeState(null)).toBe('auto-fixable')
  })

  it('includes the detection command output when node is installed', async () => {
    runCommandMock.mockResolvedValue({
      exitCode: 0,
      stderr: '',
      stdout: 'v24.14.0\n'
    })

    const result = await detectNode()

    expect(result.command).toBe('node -v')
    expect(result.observedOutput).toBe('v24.14.0')
    expect(result.detail).toBe('已检测到 v24.14.0')
    expect(result.status).toBe('satisfied')
  })
})
