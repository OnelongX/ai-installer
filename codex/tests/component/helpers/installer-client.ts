import type { InstallerClient } from '../../../src/renderer/install-flow/client'

/**
 * Baseline InstallerClient for component tests (same helper as claude/).
 *
 * Each test drives one screen and only cares about a few methods, but
 * `InstallerClient` is the full IPC surface. Inline mocks used to spell all of
 * it out and silently went type-broken whenever a method was added, because
 * the project's typecheck was itself broken.
 *
 * Pass only what the test exercises; everything else answers with an inert
 * default that keeps the app on its happy path.
 */
export function createTestInstallerClient(
  overrides: Partial<InstallerClient> = {}
): InstallerClient {
  return {
    dismissRecoveryState: async () => {},
    exportDiagnostics: async () => '',
    generatePlan: async () => ({
      summary: '在这台电脑上安装 Codex',
      tasks: ['install-codex', 'verify-codex-runtime']
    }),
    getAppInfo: async () => ({ title: 'Codex 安装器', version: '0.0.0-test' }),
    getDesktopAppState: async () => ({
      displayName: 'Codex 桌面版',
      downloadUrl: 'https://openai.com/codex/get-started/',
      installed: false,
      statusMessage: '未检测到 Codex 桌面版。'
    }),
    getExistingApiKey: async () => ({ exists: false as const }),
    getRecoveryState: async () => ({
      available: false,
      completedTasks: [],
      pendingTasks: [],
      recentLogs: [],
      summary: '未发现未完成的安装会话。'
    }),
    listModels: async () => ({ models: [] }),
    loadEnvironment: async () => [],
    openDesktopApp: async () => false,
    openDesktopAppInstall: async () => false,
    probeNetwork: async () => ({
      internalReachable: false,
      network: 'external' as const,
      resolvedBaseUrl: 'https://ai-api.solaeon.com'
    }),
    resumeInstall: async () => ({
      issue: {
        category: 'process',
        message: 'Resume unavailable in this test',
        userAction: 'Retry instead.'
      },
      status: 'failed' as const
    }),
    retryTask: async () => ({
      issue: {
        category: 'process',
        message: 'Retry unavailable in this test',
        userAction: 'Start a new installation.'
      },
      status: 'failed' as const
    }),
    startInstall: async () => ({
      codexVersion: '0.0.0-test',
      configPath: 'C:\\Users\\Tester\\.codex\\config.toml',
      keyMask: 'sk-***test',
      logs: [],
      status: 'ready' as const
    }),
    subscribeLogs: () => () => {},
    syncModels: async () => ({
      ok: true,
      count: 0,
      path: 'C:\\Users\\Tester\\.codex\\models-catalog.json'
    }),
    validateApiKey: async () => ({ ok: true }),
    listGatewayProfiles: async () => ({ geminiInstalled: false, profiles: [] }),
    saveGatewayProfile: async () => ({ message: 'not wired in this test', ok: false }),
    deleteGatewayProfile: async () => ({ ok: true }),
    switchGateway: async () => ({ message: 'not wired in this test', ok: false, results: [] }),
    ...overrides
  }
}
