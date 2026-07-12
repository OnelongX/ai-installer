import { describe, expect, it } from 'vitest'

import { resolveProvider, baseModelIds } from '../../src/main/../shared/provider-config'
import { checkGatewayModels } from '../../src/main/installer/tasks/detect-gateway'

const solaeon = resolveProvider('solaeon')

function fakeFetch(status: number, body: unknown) {
  return async () => ({
    ok: status >= 200 && status < 300,
    status,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body))
  })
}

describe('detect-gateway checkGatewayModels', () => {
  it('passes when the gateway lists all 7 models (data-wrapped)', async () => {
    const data = baseModelIds().map((id) => ({ id }))
    const result = await checkGatewayModels(solaeon, 'sk', fakeFetch(200, { data }))
    expect(result.ok).toBe(true)
    expect(result.missing).toHaveLength(0)
    expect(result.discovered).toHaveLength(7)
  })

  it('passes when the gateway returns a bare array', async () => {
    const arr = baseModelIds().map((id) => ({ id }))
    const result = await checkGatewayModels(solaeon, 'sk', fakeFetch(200, arr))
    expect(result.ok).toBe(true)
  })

  it('reports the missing models when the gateway is short', async () => {
    const partial = baseModelIds().slice(0, 5).map((id) => ({ id }))
    const result = await checkGatewayModels(solaeon, 'sk', fakeFetch(200, { data: partial }))
    expect(result.ok).toBe(false)
    expect(result.missing).toEqual(['claude-opus-4-6', 'claude-fable-5'])
  })

  it('fails with an error message on non-2xx', async () => {
    const result = await checkGatewayModels(solaeon, 'sk', fakeFetch(401, ''))
    expect(result.ok).toBe(false)
    expect(result.error).toContain('401')
  })

  it('fails gracefully when fetch throws', async () => {
    const throwing = async () => {
      throw new Error('ECONNREFUSED')
    }
    const result = await checkGatewayModels(solaeon, 'sk', throwing)
    expect(result.ok).toBe(false)
    expect(result.error).toContain('ECONNREFUSED')
  })

  it('rejects a non-HTTPS gateway before making any request', async () => {
    let called = false
    const spyFetch = async () => {
      called = true
      return { ok: true, status: 200, text: async () => '[]' }
    }
    const httpProvider = { id: 'solaeon' as const, name: 'SolaEon', baseUrl: 'http://192.168.1.101:48760' }
    const result = await checkGatewayModels(httpProvider, 'sk', spyFetch)
    expect(result.ok).toBe(false)
    expect(result.error).toContain('HTTPS')
    expect(called).toBe(false)
  })
})
