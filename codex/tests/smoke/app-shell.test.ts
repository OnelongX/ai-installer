import { describe, expect, it } from 'vitest'
import { appShellTitle } from '../../src/shared/types'

describe('app shell constants', () => {
  it('defines the installer window title', () => {
    expect(appShellTitle).toBe('Codex 安装器')
  })
})
