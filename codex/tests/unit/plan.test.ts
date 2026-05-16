import { describe, expect, it } from 'vitest'
import { buildInstallPlan } from '../../src/main/installer/plan'

describe('install planning', () => {
  it('includes codex installation when codex is missing', () => {
    const plan = buildInstallPlan({
      apiKeyMode: 'user-env',
      codexInstalled: false,
      nodeInstalled: true
    })

    expect(plan.tasks).toContain('install-codex')
  })
})
