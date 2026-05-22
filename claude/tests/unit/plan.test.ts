import { describe, expect, it } from 'vitest'
import { buildInstallPlan } from '../../src/main/installer/plan'

describe('install planning', () => {
  it('includes claude installation when claude is missing', () => {
    const plan = buildInstallPlan({
      apiKeyMode: 'user-env',
      claudeInstalled: false,
      nodeInstalled: true
    })

    expect(plan.tasks).toContain('install-claude')
  })

  it('inserts clear-anthropic-oauth before write-config when OAuth credentials exist', () => {
    const plan = buildInstallPlan({
      apiKeyMode: 'user-env',
      claudeInstalled: true,
      nodeInstalled: true,
      oauthCredentialsExist: true
    })

    const clearIdx = plan.tasks.indexOf('clear-anthropic-oauth')
    const writeIdx = plan.tasks.indexOf('write-config')

    expect(clearIdx).toBeGreaterThanOrEqual(0)
    expect(writeIdx).toBeGreaterThan(clearIdx)
  })

  it('skips clear-anthropic-oauth when no OAuth credentials exist', () => {
    const plan = buildInstallPlan({
      apiKeyMode: 'user-env',
      claudeInstalled: true,
      nodeInstalled: true,
      oauthCredentialsExist: false
    })

    expect(plan.tasks).not.toContain('clear-anthropic-oauth')
  })
})
