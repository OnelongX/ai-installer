import { describe, expect, it } from 'vitest'
import { appShellTitle } from '../../src/shared/types'

describe('app shell constants', () => {
  it('defines the installer window title', () => {
    expect(appShellTitle).toBe('Claude 安装器')
  })
})
