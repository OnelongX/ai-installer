import { maskSecrets } from '../system/sanitize'

interface DiagnosticReportInput {
  logs: string[]
  platform: string
  summary: string
}

export function renderDiagnosticReport(input: DiagnosticReportInput) {
  const sanitizedLogs = input.logs.map((entry) => `- ${maskSecrets(entry)}`).join('\n')

  return [
    '# Claude 安装器诊断报告',
    '',
    `平台：${input.platform}`,
    `摘要：${input.summary}`,
    '',
    '日志：',
    sanitizedLogs
  ].join('\n')
}
