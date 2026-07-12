import path from 'node:path'

import { describe, expect, it, vi } from 'vitest'
import {
  buildSettingsJson,
  ensureSettingsJson,
  getSettingsJsonPath
} from '../../src/main/installer/tasks/write-config.windows'

describe('windows settings.json generation', () => {
  it('defaults to the SolaEon gateway with Opus 4.8 + 7-model whitelist', () => {
    const json = buildSettingsJson()
    const parsed = JSON.parse(json)

    expect(parsed.model).toBe('claude-opus-4-8')
    expect(parsed.env.ANTHROPIC_BASE_URL).toBe('https://ai-api.solaeon.com')
    expect(parsed.env.ANTHROPIC_DEFAULT_OPUS_MODEL).toBe('claude-opus-4-8')
    expect(parsed.env.ANTHROPIC_DEFAULT_SONNET_MODEL).toBe('claude-sonnet-5')
    expect(parsed.env.ANTHROPIC_DEFAULT_HAIKU_MODEL).toBe('claude-haiku-4-5')
    expect(parsed.env.API_TIMEOUT_MS).toBe('300000')
    // Force-off the per-request attribution header so third-party Anthropic
    // gateways can keep prefix caches hot — see write-config.windows.ts.
    expect(parsed.env.CLAUDE_CODE_ATTRIBUTION_HEADER).toBe('0')
    expect(parsed.availableModels).toHaveLength(7)
    expect(parsed.availableModels).toContain('claude-opus-4-8')
    expect(parsed.permissions).toEqual({ defaultMode: 'acceptEdits' })
    expect(json.endsWith('\n')).toBe(true)
  })

  it('bootstrap default carries no auth token', () => {
    const parsed = JSON.parse(buildSettingsJson())
    expect(parsed.env.ANTHROPIC_AUTH_TOKEN).toBeUndefined()
  })

  it('writes the key as ANTHROPIC_AUTH_TOKEN when provided', () => {
    const parsed = JSON.parse(buildSettingsJson({ apiKey: 'sk-test-123' }))
    expect(parsed.env.ANTHROPIC_AUTH_TOKEN).toBe('sk-test-123')
  })

  it('uses the LiveToken base URL when that provider is chosen', () => {
    const parsed = JSON.parse(buildSettingsJson({ providerId: 'livetoken' }))
    expect(parsed.env.ANTHROPIC_BASE_URL).toBe('https://livetoken.top')
  })

  it('creates the default settings.json when it is missing', async () => {
    const mkdir = vi.fn(async () => {})
    const writeFile = vi.fn(async () => {})
    const userProfile = 'C:\\Users\\Administrator'

    const result = await ensureSettingsJson({
      fileExists: async () => false,
      mkdir,
      userProfile,
      writeFile
    })

    expect(result).toEqual({
      created: true,
      path: path.join(userProfile, '.claude', 'settings.json')
    })
    expect(mkdir).toHaveBeenCalledWith(path.join(userProfile, '.claude'))
    expect(writeFile).toHaveBeenCalledWith(
      path.join(userProfile, '.claude', 'settings.json'),
      buildSettingsJson()
    )
  })

  it('skips rewriting settings.json when it already exists', async () => {
    const mkdir = vi.fn(async () => {})
    const writeFile = vi.fn(async () => {})

    const result = await ensureSettingsJson({
      fileExists: async (targetPath) =>
        targetPath === getSettingsJsonPath('C:\\Users\\Administrator'),
      mkdir,
      userProfile: 'C:\\Users\\Administrator',
      writeFile
    })

    expect(result).toEqual({
      created: false,
      path: path.join('C:\\Users\\Administrator', '.claude', 'settings.json')
    })
    expect(mkdir).not.toHaveBeenCalled()
    expect(writeFile).not.toHaveBeenCalled()
  })
})
