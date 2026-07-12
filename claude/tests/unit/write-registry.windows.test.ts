import { describe, expect, it } from 'vitest'

import { resolveProvider } from '../../src/main/../shared/provider-config'
import {
  CLAUDE_POLICY_KEY,
  buildInferenceModelsJson,
  buildRegistryValues,
  buildWriteRegistryCommand
} from '../../src/main/installer/tasks/write-registry.windows'

const solaeon = resolveProvider('solaeon')

describe('write-registry.windows', () => {
  it('targets the HKCU Claude policy key', () => {
    expect(CLAUDE_POLICY_KEY).toBe('HKCU\\Software\\Policies\\Claude')
  })

  it('inferenceModels serializes to a 7-item JSON array', () => {
    const json = buildInferenceModelsJson()
    const parsed = JSON.parse(json)
    expect(json.startsWith('[')).toBe(true)
    expect(parsed).toHaveLength(7)
    expect(parsed.filter((m: { supports1m?: boolean }) => m.supports1m)).toHaveLength(3)
  })

  it('emits the six managed-config REG_SZ values', () => {
    const values = buildRegistryValues(solaeon, 'sk-test')
    const byName = Object.fromEntries(values.map((v) => [v.name, v.value]))
    expect(byName.inferenceProvider).toBe('gateway')
    expect(byName.inferenceGatewayBaseUrl).toBe('https://ai-api.solaeon.com')
    expect(byName.inferenceGatewayAuthScheme).toBe('bearer')
    expect(byName.inferenceGatewayApiKey).toBe('sk-test')
    expect(byName.modelDiscoveryEnabled).toBe('false')
    expect(byName.inferenceModels.startsWith('[')).toBe(true)
  })

  it('the PowerShell command uses HKCU: path, single-quote escaping and post-write validation', () => {
    const cmd = buildWriteRegistryCommand(solaeon, "sk-with'quote")
    expect(cmd).toContain("HKCU:\\Software\\Policies\\Claude")
    expect(cmd).toContain("New-Item")
    expect(cmd).toContain("Set-ItemProperty")
    // single quote in the key value must be doubled
    expect(cmd).toContain("sk-with''quote")
    // post-write guard
    expect(cmd).toContain('inferenceModels registry validation failed')
  })
})
