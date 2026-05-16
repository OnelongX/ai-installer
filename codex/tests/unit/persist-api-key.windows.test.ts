import { describe, expect, it } from 'vitest'
import { buildPersistApiKeyCommand } from '../../src/main/installer/tasks/persist-api-key.windows'

describe('windows api key persistence', () => {
  it('writes the key to the user environment variables', () => {
    expect(buildPersistApiKeyCommand('sk-test-key')).toBe(
      "[Environment]::SetEnvironmentVariable('OPENAI_API_KEY', 'sk-test-key', 'User')"
    )
  })

  it('escapes single quotes inside the key value', () => {
    expect(buildPersistApiKeyCommand("sk-it's-a-key")).toBe(
      "[Environment]::SetEnvironmentVariable('OPENAI_API_KEY', 'sk-it''s-a-key', 'User')"
    )
  })
})
