import { describe, expect, it } from 'vitest'

import { createGatewayProfileStore } from '../../src/main/installer/gateway-profiles'

function createStore(initial: string | null = null) {
  const files = new Map<string, string>()
  if (initial !== null) files.set('/data/gateway-profiles.json', initial)
  let id = 0
  const store = createGatewayProfileStore({
    filePath: '/data/gateway-profiles.json',
    mkdir: async () => {},
    readFile: async (path) => files.get(path) ?? null,
    writeFile: async (path, value) => {
      files.set(path, value)
    },
    encrypt: (plain) => `enc(${plain})`,
    decrypt: (cipher) => cipher.slice(4, -1),
    newId: () => `p${++id}`,
    now: () => new Date('2026-10-21T00:00:00.000Z')
  })
  return { files, store }
}

const solaeon = {
  name: 'SolaEon 内网',
  provider: 'solaeon' as const,
  networkMode: 'internal' as const,
  codexModel: 'gpt-5.5',
  geminiModel: 'gemini-3-pro'
}

describe('gateway profile store', () => {
  it('saves a profile with the key encrypted and only a mask exposed', async () => {
    const { files, store } = createStore()

    const saved = await store.save({ ...solaeon, apiKey: 'sk-secret-123456' })

    expect(saved).toEqual({
      ...solaeon,
      id: 'p1',
      keyMask: 'sk***3456',
      updatedAt: '2026-10-21T00:00:00.000Z'
    })
    expect(saved).not.toHaveProperty('keyCipher')
    const raw = files.get('/data/gateway-profiles.json')!
    expect(raw).not.toContain('"sk-secret-123456"')
    expect(raw).toContain('enc(sk-secret-123456)')
    expect(await store.getKey('p1')).toBe('sk-secret-123456')
  })

  it('keeps the saved key when editing without a new one', async () => {
    const { store } = createStore()
    await store.save({ ...solaeon, apiKey: 'sk-secret-123456' })

    const edited = await store.save({ ...solaeon, id: 'p1', name: '改名', codexModel: 'kimi-k3' })

    expect(edited).toMatchObject({ id: 'p1', name: '改名', codexModel: 'kimi-k3', keyMask: 'sk***3456' })
    expect(await store.getKey('p1')).toBe('sk-secret-123456')
    expect((await store.list()).profiles).toHaveLength(1)
  })

  it('validates new profiles', async () => {
    const { store } = createStore()
    await expect(store.save({ ...solaeon })).rejects.toThrow('API Key')
    await expect(store.save({ ...solaeon, name: ' ', apiKey: 'sk-x' })).rejects.toThrow('名称')
    await expect(store.save({ ...solaeon, id: 'missing', apiKey: 'sk-x' })).rejects.toThrow('找不到')
  })

  it('tracks and clears the active profile', async () => {
    const { store } = createStore()
    await store.save({ ...solaeon, apiKey: 'sk-secret-123456' })
    await store.setActive('p1')
    expect((await store.list()).activeProfileId).toBe('p1')

    await store.remove('p1')
    expect(await store.list()).toEqual({ activeProfileId: undefined, profiles: [] })
  })

  it('treats a corrupt file as an error instead of silently dropping profiles', async () => {
    const { store } = createStore('{"profiles": "nope"}')
    await expect(store.list()).rejects.toThrow('格式不正确')
  })
})
