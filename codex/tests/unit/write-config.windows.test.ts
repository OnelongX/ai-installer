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

describe('windows config generation', () => {
  it('writes the complete cm provider template', () => {
    expect(buildConfigToml({ mode: 'official' })).toBe(expectedConfigToml)
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

    expect(result).toEqual({
      created: true,
      path: path.join(userProfile, '.codex', 'config.toml')
    })
    expect(mkdir).toHaveBeenCalledWith(path.join(userProfile, '.codex'))
    expect(writeFile).toHaveBeenCalledWith(
      path.join(userProfile, '.codex', 'config.toml'),
      expectedConfigToml
    )
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
