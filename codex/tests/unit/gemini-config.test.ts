import { describe, expect, it } from 'vitest'

import {
  buildPersistGeminiEnvCommand,
  mergeGeminiSettings
} from '../../src/main/installer/tasks/gemini-config'
import { geminiBaseUrl } from '../../src/shared/gateway-switch'

describe('gemini settings.json merge', () => {
  it('writes the nested auth + model shape for a fresh file', () => {
    expect(JSON.parse(mergeGeminiSettings(null, 'gemini-3-pro'))).toEqual({
      security: { auth: { selectedType: 'gemini-api-key' } },
      model: { name: 'gemini-3-pro' }
    })
  })

  it('keeps mcpServers and other settings, only touching auth + model.name', () => {
    const existing = JSON.stringify({
      mcpServers: { pencil: { command: 'c:\\pencil.exe', args: ['--agent', 'geminiCLI'] } },
      ui: { theme: 'Default' },
      security: { auth: { selectedType: 'oauth-personal', useExternal: true }, folderTrust: { enabled: true } },
      model: { name: 'gemini-2.5-pro', maxSessionTurns: 50 }
    })

    expect(JSON.parse(mergeGeminiSettings(existing, 'gemini-3.5-flash'))).toEqual({
      mcpServers: { pencil: { command: 'c:\\pencil.exe', args: ['--agent', 'geminiCLI'] } },
      ui: { theme: 'Default' },
      security: {
        auth: { selectedType: 'gemini-api-key', useExternal: true },
        folderTrust: { enabled: true }
      },
      model: { name: 'gemini-3.5-flash', maxSessionTurns: 50 }
    })
  })

  it('drops the legacy flat keys the old configure scripts wrote', () => {
    const legacy = JSON.stringify({ selectedAuthType: 'gemini-api-key', model: 'gemini-2.5-pro', theme: 'Default' })

    expect(JSON.parse(mergeGeminiSettings(legacy, 'gemini-3-pro'))).toEqual({
      theme: 'Default',
      security: { auth: { selectedType: 'gemini-api-key' } },
      model: { name: 'gemini-3-pro' }
    })
  })

  it('refuses to replace a file that is not a JSON object', () => {
    expect(() => mergeGeminiSettings('{ broken', 'gemini-3-pro')).toThrow()
    expect(() => mergeGeminiSettings('[1, 2]', 'gemini-3-pro')).toThrow('不是 JSON 对象')
  })
})

describe('gemini env + base url', () => {
  it('uses the gateway root as GOOGLE_GEMINI_BASE_URL (the SDK adds /v1beta)', () => {
    expect(geminiBaseUrl('https://gateway.example/v1')).toBe('https://gateway.example')
    expect(geminiBaseUrl('http://192.168.1.101:48760')).toBe('http://192.168.1.101:48760')
    expect(geminiBaseUrl('https://ai-api.solaeon.com/')).toBe('https://ai-api.solaeon.com')
  })

  it('persists both env vars for the user with quotes escaped', () => {
    expect(buildPersistGeminiEnvCommand("sk-a'b", 'https://ai-api.solaeon.com')).toBe(
      "[Environment]::SetEnvironmentVariable('GEMINI_API_KEY', 'sk-a''b', 'User'); " +
        "[Environment]::SetEnvironmentVariable('GOOGLE_GEMINI_BASE_URL', 'https://ai-api.solaeon.com', 'User')"
    )
  })
})
