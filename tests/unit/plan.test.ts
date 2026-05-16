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
})
