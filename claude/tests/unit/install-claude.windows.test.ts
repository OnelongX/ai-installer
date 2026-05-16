import { describe, expect, it } from 'vitest'

import { getInstallClaudeWindowsCommand } from '../../src/main/installer/tasks/install-claude.windows'

describe('install claude windows command', () => {
  it('invokes npm directly instead of going through powershell', () => {
    expect(getInstallClaudeWindowsCommand()).toEqual({
      args: ['i', '-g', '@anthropic-ai/claude-code'],
      command: 'npm'
    })
  })
})
