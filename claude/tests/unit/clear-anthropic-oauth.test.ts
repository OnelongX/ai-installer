import path from 'node:path'

import { describe, expect, it, vi } from 'vitest'

import {
  clearOAuthCredentials,
  detectOAuthCredentials,
  getOAuthCredentialsPath
} from '../../src/main/installer/tasks/clear-anthropic-oauth'

describe('clear-anthropic-oauth', () => {
  const userProfile = 'C:\\Users\\Administrator'
  const credPath = path.join(userProfile, '.claude', '.credentials.json')

  it('points at %USERPROFILE%/.claude/.credentials.json', () => {
    expect(getOAuthCredentialsPath(userProfile)).toBe(credPath)
  })

  it('detects credentials when the file exists', async () => {
    const fileExists = vi.fn(async (p: string) => p === credPath)
    const result = await detectOAuthCredentials({ fileExists }, userProfile)

    expect(result.exists).toBe(true)
    expect(result.path).toBe(credPath)
  })

  it('reports absent when the file is missing', async () => {
    const result = await detectOAuthCredentials({ fileExists: async () => false }, userProfile)
    expect(result.exists).toBe(false)
  })

  it('renames the credentials to a timestamped backup', async () => {
    const renames: Array<{ from: string; to: string }> = []
    const result = await clearOAuthCredentials(
      {
        fileExists: async (p: string) => p === credPath,
        rename: async (from, to) => {
          renames.push({ from, to })
        }
      },
      userProfile
    )

    expect(result.cleared).toBe(true)
    expect(result.backupPath).toMatch(/\.credentials\.json\.bak\.\d{8}-\d{6}$/)
    expect(renames).toHaveLength(1)
    expect(renames[0]?.from).toBe(credPath)
    expect(renames[0]?.to).toBe(result.backupPath)
  })

  it('is a no-op when no credentials file exists', async () => {
    const renames: Array<{ from: string; to: string }> = []
    const result = await clearOAuthCredentials(
      {
        fileExists: async () => false,
        rename: async (from, to) => {
          renames.push({ from, to })
        }
      },
      userProfile
    )

    expect(result.cleared).toBe(false)
    expect(result.backupPath).toBeNull()
    expect(renames).toHaveLength(0)
  })
})
