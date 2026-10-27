import { describe, expect, it } from 'vitest'
import {
  buildConfigToml,
  buildGatewayConfigToml,
  getConfigBackupPath,
  mergeInstallerConfig
} from '../../src/main/installer/tasks/write-config.windows'

const expectedConfigToml = [
  'personality = "pragmatic"',
  'model = "gpt-5.5"',
  'model_provider = "cm"',
  'forced_login_method = "api"',
  'review_model = "gpt-5.5"',
  'model_reasoning_effort = "high"',
  'plan_mode_reasoning_effort = "xhigh"',
  'model_reasoning_summary = "detailed"',
  'model_verbosity = "medium"',
  'approval_policy = "on-request"',
  'allow_login_shell = true',
  'sandbox_mode = "workspace-write"',
  'cli_auth_credentials_store = "file"',
  'chatgpt_base_url = "https://chatgpt.com/backend-api/"',
  'mcp_oauth_credentials_store = "auto"',
  'check_for_update_on_startup = true',
  'web_search = "live"',
  'approvals_reviewer = "user"',
  '',
  '[model_providers.cm]',
  'name = "Solaeon"',
  'base_url = "https://ai-api.solaeon.com"',
  'wire_api = "responses"',
  'env_key = "OPENAI_API_KEY"',
  '',
  '[desktop]',
  'conversationDetailMode = "STEPS_COMMANDS"'
].join('\n')

const solaeonInternalConfig = expectedConfigToml.replace(
  'base_url = "https://ai-api.solaeon.com"',
  'base_url = "http://192.168.1.101:48760"'
)

const solaeonExternalConfig = expectedConfigToml

describe('windows config generation', () => {
  it('defaults to the SolaEon (WAN) provider template', () => {
    expect(buildConfigToml()).toBe(expectedConfigToml)
  })

  it('defaults model + review_model to gpt-5.5', () => {
    const toml = buildConfigToml()
    expect(toml).toContain('model = "gpt-5.5"')
    expect(toml).toContain('review_model = "gpt-5.5"')
  })

  it('forces api-key auth so Codex uses the key instead of ChatGPT login', () => {
    const toml = buildConfigToml()
    expect(toml).not.toContain('preferred_auth_method')
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

  it('pins the desktop detail mode to STEPS_COMMANDS', () => {
    expect(buildConfigToml()).toMatch(
      /\n\[desktop\]\nconversationDetailMode = "STEPS_COMMANDS"$/
    )
  })

  it('returns the rendered config unchanged when there is no existing config', () => {
    const rendered = buildConfigToml()
    expect(mergeInstallerConfig(rendered, null)).toBe(rendered)
    expect(mergeInstallerConfig(rendered, '  \n')).toBe(rendered)
  })

  it('names config backups after the original file with a timestamp', () => {
    expect(
      getConfigBackupPath('C:\\Users\\A\\.codex\\config.toml', new Date('2026-10-21T13:05:09.123Z'))
    ).toBe('C:\\Users\\A\\.codex\\config.toml.bak-installer-2026-10-21T13-05-09-123Z')
  })

  it('keeps existing [desktop] keys and sub-tables but forces STEPS_COMMANDS', () => {
    const existing = [
      'model = "old"',
      '',
      '[desktop]',
      'keepRemoteControlAwakeWhilePluggedIn = true',
      'conversationDetailMode = "STEPS_PROSE"',
      'followUpQueueMode = "queue"',
      '',
      '[desktop.open-in-target-preferences]',
      'global = "fileManager"',
      '',
      '[desktop.open-in-target-preferences.perPath]',
      '"E:\\\\gateway" = "vscode"',
      '',
      '[features]',
      'js_repl = false'
    ].join('\r\n')

    const merged = mergeInstallerConfig(buildConfigToml(), existing)
    const rendered = buildConfigToml()
    const renderedRoot = rendered.split('\n\n[model_providers.cm]')[0]
    const renderedProvider = rendered.split('\n\n[desktop]')[0].split('\n\n').pop()

    expect(merged).toBe(
      [
        renderedRoot,
        '',
        '[desktop]',
        'conversationDetailMode = "STEPS_COMMANDS"',
        'keepRemoteControlAwakeWhilePluggedIn = true',
        'followUpQueueMode = "queue"',
        '',
        '[desktop.open-in-target-preferences]',
        'global = "fileManager"',
        '',
        '[desktop.open-in-target-preferences.perPath]',
        '"E:\\\\gateway" = "vscode"',
        '',
        '[features]',
        'js_repl = false',
        '',
        renderedProvider
      ].join('\n')
    )
    expect(merged).not.toContain('STEPS_PROSE')
    expect(merged).not.toContain('model = "old"')
  })

  it('replaces an existing [model_providers.cm] instead of merging into it', () => {
    const existing = [
      '[model_providers.cm]',
      'name = "Old"',
      'base_url = "https://old.example/v1"',
      'experimental_bearer_token = "stale"'
    ].join('\n')

    const merged = mergeInstallerConfig(buildConfigToml(), existing)

    expect(merged).toContain('base_url = "https://ai-api.solaeon.com"')
    expect(merged).not.toContain('old.example')
    expect(merged).not.toContain('experimental_bearer_token')
  })

  it('builds a gateway-only config for 切换网关', () => {
    expect(
      buildGatewayConfigToml({
        providerId: 'solaeon',
        networkMode: 'internal',
        model: 'kimi-k3',
        catalogPath: 'D:/codex-home/models-catalog.json'
      })
    ).toBe(
      [
        'model = "kimi-k3"',
        'model_provider = "cm"',
        "model_catalog_json = 'D:/codex-home/models-catalog.json'",
              'forced_login_method = "api"',
        'review_model = "kimi-k3"',
        '',
        '[model_providers.cm]',
        'name = "Solaeon"',
        'base_url = "http://192.168.1.101:48760"',
        'wire_api = "responses"',
        'env_key = "OPENAI_API_KEY"',
        '',
        '[desktop]',
        'conversationDetailMode = "STEPS_COMMANDS"'
      ].join('\n')
    )
  })

  it("switching the gateway keeps the user's own preferences", () => {
    const existing = [
      'personality = "friendly"',
      'model = "gpt-5.4"',
      'model_reasoning_effort = "low"',
      'sandbox_mode = "danger-full-access"',
      'approval_policy = "never"',
      'service_tier = "priority"'
    ].join('\n')

    const merged = mergeInstallerConfig(buildGatewayConfigToml({ model: 'gpt-5.5' }), existing)

    for (const kept of [
      'personality = "friendly"',
      'model_reasoning_effort = "low"',
      'sandbox_mode = "danger-full-access"',
      'approval_policy = "never"',
      'service_tier = "priority"'
    ]) {
      expect(merged).toContain(kept)
    }
    expect(merged).toContain('model = "gpt-5.5"')
    expect(merged).not.toContain('model = "gpt-5.4"')
  })

  it('only writes ModelProviderInfo fields and no service_tier', () => {
    const providerTable = buildConfigToml().split('[model_providers.cm]\n')[1].split('\n\n')[0]
    expect(providerTable.split('\n').map((line) => line.split(' = ')[0])).toEqual([
      'name',
      'base_url',
      'wire_api',
      'env_key'
    ])
    expect(buildConfigToml()).not.toContain('service_tier')
  })

  it('writes no keys that current Codex reports as "is ignored"', () => {
    // Found by loading the generated config with codex-cli 0.157 / 0.164.
    for (const ignored of ['preferred_auth_method', 'model_supports_reasoning_summaries']) {
      expect(buildConfigToml()).not.toContain(ignored)
    }
  })
})
