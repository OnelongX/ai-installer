import { describe, expect, it } from 'vitest'
import { maskSecrets } from '../../src/main/system/sanitize'

describe('secret masking', () => {
  it('masks API keys in log text', () => {
    expect(maskSecrets('OPENAI_API_KEY=sk-test-secret')).not.toContain('sk-test-secret')
  })
})
