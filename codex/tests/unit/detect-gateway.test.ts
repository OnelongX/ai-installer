import { describe, expect, it } from 'vitest'

import { resolveProvider } from '../../src/shared/provider-config'
import {
  checkGatewayReachable,
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
})
