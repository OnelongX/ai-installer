import path from 'node:path'

import { describe, expect, it, vi } from 'vitest'
import {
  buildSettingsJson,
  ensureSettingsJson,
  getSettingsJsonPath
} from '../../src/main/installer/tasks/write-config.windows'

describe('windows settings.json generation', () => {
  it('writes the LiveToken provider template with claude-sonnet-4-5 defaults', () => {
    const json = buildSettingsJson({ mode: 'official' })
    const parsed = JSON.parse(json)

    expect(parsed.model).toBe('claude-sonnet-4-5')
    expect(parsed.env.ANTHROPIC_BASE_URL).toBe('https://livetoken.top')
    expect(parsed.env.ANTHROPIC_MODEL).toBe('claude-sonnet-4-5')
    expect(parsed.permissions).toEqual({ defaultMode: 'acceptEdits' })
    expect(json.endsWith('\n')).toBe(true)
  })

  it('respects a custom baseUrl when provided', () => {
    const json = buildSettingsJson({ mode: 'custom', baseUrl: 'https://example.test' })
    expect(JSON.parse(json).env.ANTHROPIC_BASE_URL).toBe('https://example.test')
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
      buildSettingsJson({ mode: 'official' })
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
