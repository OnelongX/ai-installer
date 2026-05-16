import { describe, expect, it } from 'vitest'
import { normalizePlatform } from '../../src/main/platform/detect'

describe('platform detection', () => {
  it('maps win32 to windows', () => {
    expect(normalizePlatform('win32')).toBe('windows')
  })
})
