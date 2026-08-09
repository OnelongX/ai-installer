import { describe, expect, it } from 'vitest'

import { resolveProvider } from '../../src/shared/provider-config'
import { modelsFromIds } from '../../src/shared/models'
import {
  checkGatewayReachable,
  fetchGatewayModelIds,
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

  it('fetchGatewayModelIds returns [] on failure so the UI keeps its fallback', async () => {
    expect(await fetchGatewayModelIds(livetoken, 'sk', fakeFetch(401, ''))).toEqual([])
    expect(
      await fetchGatewayModelIds(livetoken, 'sk', async () => {
        throw new Error('boom')
      })
    ).toEqual([])
  })

  it('modelsFromIds labels known models and passes unknown ids through', () => {
    const cards = modelsFromIds(['gpt-5.6-sol', 'some-new-model'])
    expect(cards[0].label).toBe('GPT-5.6 Sol')
    expect(cards[1]).toEqual({ id: 'some-new-model', label: 'some-new-model', detail: '网关模型' })
  })
})
