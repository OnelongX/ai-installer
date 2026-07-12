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

  it('orders gateway verify → write-config → desktop registry → runtime verify', () => {
    const plan = buildInstallPlan({
      apiKeyMode: 'user-env',
      claudeInstalled: true,
      nodeInstalled: true
    })

    const order = ['verify-gateway', 'write-config', 'write-desktop-registry', 'verify-claude-runtime']
    const indices = order.map((t) => plan.tasks.indexOf(t))
    expect(indices.every((i) => i >= 0)).toBe(true)
    expect(indices).toEqual([...indices].sort((a, b) => a - b))
  })
})
