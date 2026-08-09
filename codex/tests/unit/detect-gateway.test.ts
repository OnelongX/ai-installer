import { describe, expect, it } from 'vitest'

import { resolveProvider } from '../../src/shared/provider-config'
import { codexModels, mergeGatewayModels } from '../../src/shared/models'
import {
  checkGatewayReachable,
  fetchGatewayModelIds,
  fetchGatewayModels,
  modelsEndpoint
} from '../../src/main/installer/tasks/detect-gateway'

describe('codex detect-gateway', () => {
  it('normalizes base_url to {root}/v1/models', () => {
    expect(modelsEndpoint('https://livetoken.top/v1')).toBe('https://livetoken.top/v1/models')
    expect(modelsEndpoint('https://ai-api.solaeon.com')).toBe(
      'https://ai-api.solaeon.com/v1/models'
    )
    expect(modelsEndpoint('http://192.168.1.101:48760/')).toBe(
      'http://192.168.1.101:48760/v1/models'
    )
  })

  const livetoken = resolveProvider('livetoken')

  function fakeFetch(status: number, body: unknown) {
    return async () => ({
      ok: status >= 200 && status < 300,
      status,
      text: async () => (typeof body === 'string' ? body : JSON.stringify(body))
    })
  }

  it('passes and counts models on a 200 with data', async () => {
    const result = await checkGatewayReachable(
      livetoken,
      'sk',
      fakeFetch(200, { data: [{ id: 'gpt-5.5' }, { id: 'gpt-5' }] })
    )
    expect(result.ok).toBe(true)
    expect(result.modelCount).toBe(2)
  })

  it('fails on non-2xx', async () => {
    const result = await checkGatewayReachable(livetoken, 'sk', fakeFetch(403, ''))
    expect(result.ok).toBe(false)
    expect(result.error).toContain('403')
  })

  it('fails gracefully when fetch throws', async () => {
    const result = await checkGatewayReachable(livetoken, 'sk', async () => {
      throw new Error('ENOTFOUND')
    })
    expect(result.ok).toBe(false)
    expect(result.error).toContain('ENOTFOUND')
  })

  it('fetchGatewayModelIds returns the id list (data-wrapped)', async () => {
    const ids = await fetchGatewayModelIds(
      livetoken,
      'sk',
      fakeFetch(200, { data: [{ id: 'gpt-5.6-sol' }, { id: 'kimi-k3' }] })
    )
    expect(ids).toEqual(['gpt-5.6-sol', 'kimi-k3'])
  })

  it('parses the SolaEon Codex shape ({models:[{slug, display_name}]})', async () => {
    const models = await fetchGatewayModels(
      livetoken,
      'sk',
      fakeFetch(200, {
        models: [
          { slug: 'gpt-5.6-sol', display_name: 'GPT-5.6 Sol' },
          { slug: 'gpt-5.3-codex', display_name: 'GPT-5.3-Codex' }
        ]
      })
    )
    expect(models).toEqual([
      { id: 'gpt-5.6-sol', label: 'GPT-5.6 Sol' },
      { id: 'gpt-5.3-codex', label: 'GPT-5.3-Codex' }
    ])
  })

  it('fetchGatewayModels returns [] on failure so the UI keeps its fallback', async () => {
    expect(await fetchGatewayModels(livetoken, 'sk', fakeFetch(401, ''))).toEqual([])
    expect(
      await fetchGatewayModels(livetoken, 'sk', async () => {
        throw new Error('boom')
      })
    ).toEqual([])
  })

  it('mergeGatewayModels keeps built-in models (deepseek/kimi) and appends new gateway ones', () => {
    // Gateway only lists GPT/Codex — deepseek/kimi are not advertised.
    const merged = mergeGatewayModels([
      { id: 'gpt-5.6-sol', label: 'ignored' },
      { id: 'gpt-5.3-codex', label: 'GPT-5.3-Codex' }
    ])
    // Every curated model survives — the whole built-in catalog is the prefix.
    expect(merged.slice(0, codexModels.length)).toEqual(codexModels)
    expect(merged.some((m) => m.id === 'deepseek-v4-flash')).toBe(true)
    expect(merged.some((m) => m.id === 'kimi-k3')).toBe(true)
    // Curated label/detail win over the gateway's for known ids.
    expect(merged.find((m) => m.id === 'gpt-5.6-sol')?.detail).toBe('OpenAI · 旗舰，最强编码')
    // A gateway model we don't know about is appended with the gateway label.
    expect(merged.find((m) => m.id === 'gpt-5.3-codex')).toEqual({
      id: 'gpt-5.3-codex',
      label: 'GPT-5.3-Codex',
      detail: '网关模型'
    })
  })
})
