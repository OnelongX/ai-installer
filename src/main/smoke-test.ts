export interface SmokeTestReport {
  appVersion: string
  error?: string
  platform: string
  status: 'failed' | 'ready'
  timestamp: string
  windowTitle: string
}

interface CreateSmokeTestReportInput {
  appVersion: string
  error?: string
  platform: string
  status: 'failed' | 'ready'
  windowTitle: string
}

export function getSmokeTestOutputPath(argv: string[]) {
  const match = argv.find((entry) => entry.startsWith('--smoke-test-output='))
  return match ? match.slice('--smoke-test-output='.length) : null
}

export function createSmokeTestReport(
  input: CreateSmokeTestReportInput
): SmokeTestReport {
  return {
    appVersion: input.appVersion,
    error: input.error,
    platform: input.platform,
    status: input.status,
    timestamp: new Date().toISOString(),
    windowTitle: input.windowTitle
  }
}
