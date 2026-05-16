import { describe, expect, it } from 'vitest'
import { renderDiagnosticReport } from '../../src/main/diagnostics/export'

describe('diagnostic export', () => {
  it('masks secrets in exported reports', () => {
    const report = renderDiagnosticReport({
      logs: ['OPENAI_API_KEY=sk-secret'],
      platform: 'windows',
      summary: '安装 Codex 时失败'
    })

    expect(report).toContain('# Codex 安装器诊断报告')
    expect(report).toContain('平台：windows')
    expect(report).toContain('摘要：安装 Codex 时失败')
    expect(report).not.toContain('sk-secret')
  })
})
