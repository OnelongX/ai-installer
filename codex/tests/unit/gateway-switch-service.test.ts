import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createGatewayProfileStore } from '../../src/main/installer/gateway-profiles'
import { createInstallerService } from '../../src/main/installer/service'

const userProfile = 'C:\\Users\\Tester'
const codexConfig = path.win32.join(userProfile, '.codex', 'config.toml')
const geminiSettings = path.win32.join(userProfile, '.gemini', 'settings.json')

const envKeys = ['OPENAI_API_KEY', 'GEMINI_API_KEY', 'GOOGLE_GEMINI_BASE_URL'] as const
let savedEnv: Record<string, string | undefined>

beforeEach(() => {
  savedEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]))
  // Gateway /v1/models for the catalog refresh — no real network in tests.
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ data: [{ id: 'gpt-5.5' }, { id: 'gemini-3-pro' }] })
    }))
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
  for (const key of envKeys) {
    if (savedEnv[key] === undefined) delete process.env[key]
    else process.env[key] = savedEnv[key]
  }
})

function setup(files: Record<string, string> = {}, execExitCode = 0) {
  const disk = new Map(Object.entries(files))
  const commands: string[] = []
  const profiles = createGatewayProfileStore({
    filePath: 'C:\\data\\gateway-profiles.json',
    mkdir: async () => {},
    readFile: async (p) => disk.get(p) ?? null,
    writeFile: async (p, v) => {
      disk.set(p, v)
    },
    encrypt: (plain) => `enc:${plain}`,
    decrypt: (cipher) => cipher.slice(4),
    newId: () => 'p1'
  })
  const service = createInstallerService({
    exec: async (command, args) => {
      if (command === 'powershell') {
        commands.push(args?.at(-1) ?? '')
        return { exitCode: execExitCode, stderr: execExitCode ? 'denied' : '', stdout: '' }
      }
      // `gemini --version` → not installed
      return { exitCode: 1, stderr: '', stdout: '' }
    },
    fileExists: async (p) => disk.has(p),
    mkdir: async () => {},
    profiles,
    readFile: async (p) => disk.get(p) ?? null,
    userProfile,
    writeFile: async (p, v) => {
      disk.set(p, v)
    }
  })
  return { commands, disk, service }
}

const profileInput = {
  name: 'SolaEon 外网',
  provider: 'solaeon' as const,
  // external: no LAN probe, so the test is deterministic off the office network
  networkMode: 'external' as const,
  codexModel: 'kimi-k3',
  geminiModel: 'gemini-3-pro',
  apiKey: 'sk-switch-test-9999'
}

describe('切换网关 service', () => {
  it('switches Codex and Gemini CLI, keeping their other settings', async () => {
    const { commands, disk, service } = setup({
      [codexConfig]:
        'model = "old"\nmodel_reasoning_effort = "low"\nsandbox_mode = "danger-full-access"\n' +
        'service_tier = "priority"\n\n[mcp_servers.pencil]\ncommand = "pencil.exe"\n',
      [geminiSettings]: JSON.stringify({ mcpServers: { pencil: { command: 'pencil.exe' } } })
    })
    expect(await service.saveGatewayProfile(profileInput)).toMatchObject({ ok: true })

    const result = await service.switchGateway({ profileId: 'p1', targets: ['codex', 'gemini'] })

    expect(result).toMatchObject({ ok: true, baseUrl: 'https://ai-api.solaeon.com' })
    expect(result.results.map((r) => [r.target, r.ok])).toEqual([
      ['codex', true],
      ['gemini', true]
    ])

    const config = disk.get(codexConfig)!
    expect(config).toContain('model = "kimi-k3"')
    expect(config).toContain('[mcp_servers.pencil]')
    expect(config).toContain('base_url = "https://ai-api.solaeon.com"')
    // a switch only touches gateway keys: the user's own preferences survive
    expect(config).toContain('model_reasoning_effort = "low"')
    expect(config).toContain('sandbox_mode = "danger-full-access"')
    expect(config).toContain('service_tier = "priority"')
    expect(config).not.toContain('personality')
    expect(JSON.parse(disk.get(geminiSettings)!)).toEqual({
      mcpServers: { pencil: { command: 'pencil.exe' } },
      security: { auth: { selectedType: 'gemini-api-key' } },
      model: { name: 'gemini-3-pro' }
    })
    // both originals backed up
    expect([...disk.keys()].filter((p) => p.includes('.bak-installer-'))).toHaveLength(2)
    // env vars persisted for the user and visible to this process
    expect(commands).toEqual([
      "[Environment]::SetEnvironmentVariable('OPENAI_API_KEY', 'sk-switch-test-9999', 'User')",
      "[Environment]::SetEnvironmentVariable('GEMINI_API_KEY', 'sk-switch-test-9999', 'User'); " +
        "[Environment]::SetEnvironmentVariable('GOOGLE_GEMINI_BASE_URL', 'https://ai-api.solaeon.com', 'User')"
    ])
    expect(process.env.GOOGLE_GEMINI_BASE_URL).toBe('https://ai-api.solaeon.com')
    expect((await service.listGatewayProfiles()).activeProfileId).toBe('p1')
  })

  it('skips Gemini (and leaves its files alone) when the gateway has no Gemini API', async () => {
    // The SolaEon WAN proxy drops connections for /v1beta; /v1/models still works.
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.includes('/v1beta/')) throw new TypeError('fetch failed')
        return { ok: true, status: 200, text: async () => JSON.stringify({ data: [{ id: 'gpt-5.5' }] }) }
      })
    )
    const original = JSON.stringify({ mcpServers: { pencil: { command: 'pencil.exe' } } })
    const { commands, disk, service } = setup({ [geminiSettings]: original })
    await service.saveGatewayProfile(profileInput)

    const result = await service.switchGateway({ profileId: 'p1', targets: ['codex', 'gemini'] })

    expect(result.ok).toBe(false)
    expect(result.results).toEqual([
      expect.objectContaining({ target: 'codex', ok: true }),
      expect.objectContaining({
        target: 'gemini',
        ok: false,
        message: expect.stringContaining('没有开放 Gemini 接口')
      })
    ])
    expect(disk.get(geminiSettings)).toBe(original)
    expect(commands.some((c) => c.includes('GEMINI_API_KEY'))).toBe(false)
  })

  it('only switches the selected targets', async () => {
    const { disk, service } = setup()
    await service.saveGatewayProfile(profileInput)

    const result = await service.switchGateway({ profileId: 'p1', targets: ['gemini'] })

    expect(result.results.map((r) => r.target)).toEqual(['gemini'])
    expect(disk.has(codexConfig)).toBe(false)
  })

  it('leaves an unparsable Gemini file alone but still switches Codex', async () => {
    const { disk, service } = setup({ [geminiSettings]: '{ hand edited' })
    await service.saveGatewayProfile(profileInput)

    const result = await service.switchGateway({ profileId: 'p1', targets: ['codex', 'gemini'] })

    expect(result.ok).toBe(false)
    expect(result.results).toEqual([
      expect.objectContaining({ target: 'codex', ok: true }),
      expect.objectContaining({ target: 'gemini', ok: false, message: expect.stringContaining('未做修改') })
    ])
    expect(disk.get(geminiSettings)).toBe('{ hand edited')
    expect(disk.get(codexConfig)).toContain('model = "kimi-k3"')
  })

  it('reports a failed env var write instead of claiming success', async () => {
    const { service } = setup({}, 1)
    await service.saveGatewayProfile(profileInput)

    const result = await service.switchGateway({ profileId: 'p1', targets: ['codex'] })

    expect(result.ok).toBe(false)
    expect(result.results[0]).toMatchObject({ ok: false, message: 'denied' })
    expect((await service.listGatewayProfiles()).activeProfileId).toBeUndefined()
  })

  it('rejects invalid keys, unknown profiles and empty targets', async () => {
    const { service } = setup()
    expect(await service.saveGatewayProfile({ ...profileInput, apiKey: 'bad' })).toMatchObject({ ok: false })
    expect(await service.switchGateway({ profileId: 'nope', targets: ['codex'] })).toMatchObject({
      ok: false,
      message: '找不到这个网关配置'
    })
    await service.saveGatewayProfile(profileInput)
    expect(await service.switchGateway({ profileId: 'p1', targets: [] })).toMatchObject({ ok: false })
  })

  it('refuses a profile saved for the retired LiveToken gateway', async () => {
    const legacy = JSON.stringify({
      version: 1,
      profiles: [
        {
          id: 'old',
          name: 'LiveToken',
          provider: 'livetoken',
          networkMode: 'auto',
          codexModel: 'gpt-5.5',
          geminiModel: 'gemini-3-pro',
          keyMask: 'sk***9999',
          keyCipher: 'enc:sk-old-key-9999',
          updatedAt: '2026-10-21T00:00:00.000Z'
        }
      ]
    })
    const { disk, service } = setup({ 'C:\\data\\gateway-profiles.json': legacy })

    const result = await service.switchGateway({ profileId: 'old', targets: ['codex'] })

    expect(result).toMatchObject({ ok: false, results: [] })
    expect(result.message).toContain('已下线')
    expect(disk.has(codexConfig)).toBe(false)
  })

  describe('更新模型目录 (syncModels)', () => {
    const catalogPath = path.win32.join(userProfile, '.codex', 'models-catalog.json')

    it('does nothing and says why when Codex is on ChatGPT login (no gateway in config.toml)', async () => {
      const { disk, service } = setup({ [codexConfig]: 'model = "gpt-6.1-sol"\nservice_tier = "priority"\n' })

      const result = await service.syncModels({ apiKey: 'sk-switch-test-9999' })

      expect(result).toMatchObject({ ok: false, notWired: true })
      expect(result.message).toContain('没有接入 SolaEon 网关')
      expect(disk.has(catalogPath)).toBe(false)
    })

    it('does nothing when config.toml uses the gateway but points at another catalog', async () => {
      const { disk, service } = setup({
        [codexConfig]: "model_provider = \"cm\"\nmodel_catalog_json = 'D:\\elsewhere\\models.json'\n"
      })

      const result = await service.syncModels({ apiKey: 'sk-switch-test-9999' })

      expect(result).toMatchObject({ ok: false, notWired: true })
      expect(result.message).toContain('model_catalog_json')
      expect(disk.has(catalogPath)).toBe(false)
    })

    it('refreshes the catalog with a saved gateway key once Codex is switched to the gateway', async () => {
      const { disk, service } = setup()
      await service.saveGatewayProfile(profileInput)
      await service.switchGateway({ profileId: 'p1', targets: ['codex'] })
      const fetchMock = vi.fn(async (url: string, init: { headers: Record<string, string> }) => ({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ models: [{ slug: 'gpt-6.1-sol' }, { slug: 'glm-5.3' }] }),
        url,
        init
      }))
      vi.stubGlobal('fetch', fetchMock)
      delete process.env.OPENAI_API_KEY

      const result = await service.syncModels({ profileId: 'p1' })

      expect(result).toMatchObject({ ok: true, gatewayCount: 2 })
      expect(fetchMock).toHaveBeenCalledWith(
        'https://ai-api.solaeon.com/v1/models',
        expect.objectContaining({ headers: { Authorization: 'Bearer sk-switch-test-9999' } })
      )
      const catalog = JSON.parse(disk.get(catalogPath)!)
      expect(catalog.models.map((m: { slug: string }) => m.slug)).toContain('glm-5.3')
    })

    it('reports an unknown profile instead of throwing', async () => {
      const { service } = setup({
        [codexConfig]: `model_provider = "cm"\nmodel_catalog_json = '${catalogPath}'\n`
      })
      expect(await service.syncModels({ profileId: 'nope' })).toMatchObject({ ok: false })
    })
  })

  it('reports whether the gemini command is installed', async () => {
    const { service } = setup()
    expect(await service.listGatewayProfiles()).toEqual({ geminiInstalled: false, profiles: [] })
  })
})
