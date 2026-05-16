import { describe, expect, it } from 'vitest'
import {
  createSmokeTestReport,
  getSmokeTestOutputPath
} from '../../src/main/smoke-test'

describe('smoke test helpers', () => {
  it('extracts the smoke test output path from process arguments', () => {
    const outputPath = getSmokeTestOutputPath([
      'Codex 安装器.exe',
      '--smoke-test-output=C:\\temp\\codex-smoke.json'
    ])

    expect(outputPath).toBe('C:\\temp\\codex-smoke.json')
  })

  it('builds a startup smoke-test report payload', () => {
    const report = createSmokeTestReport({
      appVersion: '0.1.0',
      platform: 'win32',
      status: 'ready',
      windowTitle: 'Codex 安装器'
    })

    expect(report).toEqual({
      appVersion: '0.1.0',
      platform: 'win32',
      status: 'ready',
      timestamp: expect.any(String),
      windowTitle: 'Codex 安装器'
    })
  })
})
