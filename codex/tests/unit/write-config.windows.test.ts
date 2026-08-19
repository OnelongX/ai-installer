import path from 'node:path'

import { describe, expect, it, vi } from 'vitest'
import {
  buildConfigToml,
  ensureConfigToml,
  getConfigTomlPath
} from '../../src/main/installer/tasks/write-config.windows'

const expectedConfigToml = [
  'personality = "pragmatic"',
  'model = "gpt-5.5"',
  'model_provider = "cm"',
  'preferred_auth_method = "apikey"',
  'forced_login_method = "api"',
  'review_model = "gpt-5.5"',
  'model_reasoning_effort = "high"',
  'plan_mode_reasoning_effort = "xhigh"',
  'model_reasoning_summary = "detailed"',
  'model_verbosity = "medium"',
  'model_supports_reasoning_summaries = true',
  'approval_policy = "on-request"',
  'allow_login_shell = true',
  'sandbox_mode = "workspace-write"',
  'cli_auth_credentials_store = "file"',
  'chatgpt_base_url = "https://chatgpt.com/backend-api/"',
  'mcp_oauth_credentials_store = "auto"',
  'check_for_update_on_startup = true',
  'web_search = "live"',
  'approvals_reviewer = "user"',
  'service_tier = "fast"',
  '',
  '[model_providers.cm]',
  'approval_policy = "on-request"',
  'sandbox_mode = "workspace-write"',
  'web_search = "live"',
  'name = "LiveToken"',
  'base_url = "https://livetoken.top/v1"',
  'wire_api = "responses"',
  'env_key = "OPENAI_API_KEY"'
].join('\n')

const solaeonInternalConfig = expectedConfigToml
  .replace('name = "LiveToken"', 'name = "Solaeon"')
  .replace('base_url = "https://livetoken.top/v1"', 'base_url = "http://192.168.1.101:48760"')

const solaeonExternalConfig = expectedConfigToml
  .replace('name = "LiveToken"', 'name = "Solaeon"')
  .replace('base_url = "https://livetoken.top/v1"', 'base_url = "https://ai-api.solaeon.com"')

describe('windows config generation', () => {
  it('defaults to the LiveToken provider template', () => {
    expect(buildConfigToml()).toBe(expectedConfigToml)
  })

  it('defaults model + review_model to gpt-5.5', () => {
    const toml = buildConfigToml()
    expect(toml).toContain('model = "gpt-5.5"')
    expect(toml).toContain('review_model = "gpt-5.5"')
  })

  it('forces api-key auth so Codex uses the key instead of ChatGPT login', () => {
    const toml = buildConfigToml()
    expect(toml).toContain('preferred_auth_method = "apikey"')
    expect(toml).toContain('forced_login_method = "api"')
  })

  it('emits model_catalog_json only when a catalog path is given', () => {
    expect(buildConfigToml()).not.toContain('model_catalog_json')
    const withCatalog = buildConfigToml({
      catalogPath: 'C:\\Users\\Administrator\\.codex\\models-catalog.json'
    })
    expect(withCatalog).toContain(
      "model_catalog_json = 'C:\\Users\\Administrator\\.codex\\models-catalog.json'"
    )
  })

  it('writes the chosen model into model + review_model', () => {
    for (const model of ['gpt-5.6-sol', 'gpt-5.6-terra', 'gpt-5.6-luna', 'gpt-5.4', 'gpt-5.4-mini', 'deepseek-v4-flash', 'deepseek-v4-pro', 'kimi-k3']) {
      const toml = buildConfigToml({ model })
      expect(toml).toContain(`model = "${model}"`)
      expect(toml).toContain(`review_model = "${model}"`)
    }
  })

  it('writes Solaeon internal base_url when forced internal', () => {
    expect(buildConfigToml({ providerId: 'solaeon', networkMode: 'internal' })).toBe(
      solaeonInternalConfig
    )
  })

  it('writes Solaeon external base_url when forced external', () => {
    expect(buildConfigToml({ providerId: 'solaeon', networkMode: 'external' })).toBe(
      solaeonExternalConfig
    )
  })

  it('auto mode with reachable LAN writes the internal base_url', () => {
    expect(
      buildConfigToml({ providerId: 'solaeon', networkMode: 'auto', internalReachable: true })
    ).toBe(solaeonInternalConfig)
  })

  it('auto mode with unreachable LAN writes the external base_url', () => {
    expect(
      buildConfigToml({ providerId: 'solaeon', networkMode: 'auto', internalReachable: false })
    ).toBe(solaeonExternalConfig)
  })

  it('creates the default config file when it is missing', async () => {
    const mkdir = vi.fn(async () => {})
    const writeFile = vi.fn(async () => {})
    const userProfile = 'C:\\Users\\Administrator'

    const result = await ensureConfigToml({
      fileExists: async () => false,
      mkdir,
      userProfile,
      writeFile
    })

    const catalogPath = path.join(userProfile, '.codex', 'models-catalog.json')

    expect(result).toEqual({
      created: true,
      path: path.join(userProfile, '.codex', 'config.toml')
    })
    expect(mkdir).toHaveBeenCalledWith(path.join(userProfile, '.codex'))
    // config.toml now points at the generated catalog…
    expect(writeFile).toHaveBeenCalledWith(
      path.join(userProfile, '.codex', 'config.toml'),
      expect.stringContaining(`model_catalog_json = '${catalogPath}'`)
    )
    // …and the catalog file itself is written (offline EXTRA_MODELS at bootstrap).
    const catalogCall = writeFile.mock.calls.find((c) => c[0] === catalogPath)
    expect(catalogCall).toBeDefined()
    const catalog = JSON.parse(catalogCall![1])
    expect(catalog.models.length).toBeGreaterThan(0)
    expect(catalog.models.some((m: { slug: string }) => m.slug === 'deepseek-v4-flash')).toBe(true)
    expect(catalog.models.some((m: { slug: string }) => m.slug === 'kimi-k3')).toBe(true)
  })

  it('skips rewriting config.toml when it already exists', async () => {
    const mkdir = vi.fn(async () => {})
    const writeFile = vi.fn(async () => {})

    const result = await ensureConfigToml({
      fileExists: async (targetPath) => targetPath === getConfigTomlPath('C:\\Users\\Administrator'),
      mkdir,
      userProfile: 'C:\\Users\\Administrator',
      writeFile
    })

    expect(result).toEqual({
      created: false,
      path: 'C:\\Users\\Administrator\\.codex\\config.toml'
    })
    expect(mkdir).not.toHaveBeenCalled()
    expect(writeFile).not.toHaveBeenCalled()
  })
})
