import { describe, expect, it } from 'vitest'
import {
  canContinueFromApiKeyState,
  isApiKeyValueValid
} from '../../src/renderer/features/api-key/api-key-state'

describe('api key state', () => {
  it('blocks progress until the user picks a valid key mode', () => {
    expect(
      canContinueFromApiKeyState({
        existingKeyMask: 'sk-***1234',
        mode: null,
        value: ''
      })
    ).toBe(false)
  })

  it('accepts either sk-prefixed keys or 64-character tokens', () => {
    expect(isApiKeyValueValid('sk-test-key')).toBe(true)
    expect(
      isApiKeyValueValid(
        '2f57366b9c673670402fdbe3cf9506b0581fe224d7a6a6b5527b9f6702cfa58c'
      )
    ).toBe(true)
    expect(isApiKeyValueValid('short-token')).toBe(false)
  })
})
