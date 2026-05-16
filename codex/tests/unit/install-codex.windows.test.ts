import { describe, expect, it } from 'vitest'

import { getInstallCodexWindowsCommand } from '../../src/main/installer/tasks/install-codex.windows'

describe('install codex windows command', () => {
  it('invokes npm directly instead of going through powershell', () => {
    expect(getInstallCodexWindowsCommand()).toEqual({
      args: ['i', '-g', '@openai/codex'],
      command: 'npm'
    })
  })
})
