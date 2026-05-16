import { describe, expect, it } from 'vitest'
import { runCommand } from '../../src/main/system/exec'

describe('process execution', () => {
  it('captures stdout from a child process', async () => {
    const result = await runCommand(process.execPath, ['-e', "console.log('ok')"])

    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('ok')
  })
})
