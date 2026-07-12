import { buildInstallPlan } from '../../main/installer/plan'
import {
  ipcChannels,
  providerSiteUrl,
  type AppInfoData,
  type DesktopAppStateData,
  type DetectionItemData,
  type GeneratePlanRequest,
  type InstallExecutionResult,
  type InstallLogEvent,
  type InstallPlanData,
  type NetworkProbeResult,
  type RecoveryStateData,
  type RendererInstallerApi,
  type StartInstallRequest,
  type ValidationResult
} from '../../shared/ipc'
import { resolveProvider } from '../../shared/provider-config'
import { isApiKeyValueValid } from '../features/api-key/api-key-state'
import { runPreviewInstall } from './preview-execution'

export interface InstallerClient {
  dismissRecoveryState(): Promise<void>
  exportDiagnostics(): Promise<string>
  generatePlan(input: GeneratePlanRequest): Promise<InstallPlanData>
  getAppInfo(): Promise<AppInfoData>
  getDesktopAppState(): Promise<DesktopAppStateData>
  getRecoveryState(): Promise<RecoveryStateData>
  loadEnvironment(): Promise<DetectionItemData[]>
  openDesktopApp(): Promise<boolean>
  openDesktopAppInstall(): Promise<boolean>
  openProviderSite(): Promise<boolean>
  probeNetwork(): Promise<NetworkProbeResult>
  resumeInstall(): Promise<InstallExecutionResult>
  retryTask(taskId: string): Promise<InstallExecutionResult>
  subscribeLogs(listener: (event: InstallLogEvent) => void): () => void
  startInstall(input: StartInstallRequest): Promise<InstallExecutionResult>
  validateApiKey(input: string): Promise<ValidationResult>
}

const browserSession = {
  diagnostics: '',
  request: undefined as StartInstallRequest | undefined
}

const browserDesktopAppState: DesktopAppStateData = {
  displayName: 'Codex 桌面版',
  downloadUrl: 'https://openai.com/codex/get-started/',
  installed: false,
  statusMessage: '当前为浏览器预览模式，可在完成后前往官方页面安装 Codex 桌面版。'
}

declare global {
  interface Window {
    codexInstaller?: RendererInstallerApi
    require?: (id: string) => unknown
  }
}

const browserInstallerClient: InstallerClient = {
  async dismissRecoveryState() {
    browserSession.diagnostics = ''
    browserSession.request = undefined
  },

  async exportDiagnostics() {
    return browserSession.diagnostics
  },

  async generatePlan(input) {
    return buildInstallPlan(input)
  },

  async getAppInfo() {
    return {
      title: 'Codex 安装器',
      version: 'dev'
    }
  },

  async getDesktopAppState() {
    return browserDesktopAppState
  },

  async getRecoveryState() {
    return {
      available: false,
      completedTasks: [],
      pendingTasks: [],
      recentLogs: [],
      summary: '未发现未完成的安装会话。'
    }
  },

  async loadEnvironment() {
    return [
      {
        detail: 'Windows, Shell: powershell',
        id: 'system',
        status: 'satisfied',
        title: '操作系统'
      },
      {
        command: 'node -v',
        detail: '未检测到 Node.js',
        id: 'node',
        observedOutput: '请切换到打包版或 Electron 运行时进行真实检测。',
        status: 'auto-fixable',
        title: 'Node.js'
      },
      {
        command: 'codex --version',
        detail: '未安装 Codex CLI',
        id: 'codex',
        observedOutput: '请切换到打包版或 Electron 运行时进行真实检测。',
        status: 'auto-fixable',
        title: 'Codex CLI'
      },
      {
        command: '%USERPROFILE%\\.codex\\config.toml',
        detail: '已自动生成 C:\\Users\\Administrator\\.codex\\config.toml',
        id: 'config',
        status: 'satisfied',
        title: 'Codex 配置'
      }
    ]
  },

  async openDesktopApp() {
    return false
  },

  async openDesktopAppInstall() {
    if (typeof window !== 'undefined') {
      window.open(browserDesktopAppState.downloadUrl, '_blank', 'noopener,noreferrer')
    }

    return true
  },

  async openProviderSite() {
    if (typeof window !== 'undefined') {
      window.open(providerSiteUrl, '_blank', 'noopener,noreferrer')
    }

    return true
  },

  async probeNetwork() {
    // Browser preview can't open a TCP socket to the LAN box; assume the
    // external address so the UI still shows a sensible resolved endpoint.
    const resolved = resolveProvider('solaeon', 'auto', false)
    return {
      internalReachable: false,
      resolvedBaseUrl: resolved.baseUrl,
      network: (resolved.network ?? 'external') as 'internal' | 'external'
    }
  },

  async resumeInstall() {
    if (!browserSession.request) {
      return {
        issue: {
          category: 'process',
          message: '没有可继续的历史安装会话。',
          userAction: '请返回安装计划页面重新开始安装。'
        },
        status: 'failed'
      }
    }

    return browserInstallerClient.startInstall(browserSession.request)
  },

  async retryTask(taskId) {
    if (!browserSession.request) {
      return {
        issue: {
          category: 'process',
          message: '当前没有可用于重试的安装会话。',
          userAction: '请返回安装计划页面重新开始安装。'
        },
        status: 'failed'
      }
    }

    const index = browserSession.request.plan.tasks.indexOf(taskId)

    if (index === -1) {
      return {
        issue: {
          category: 'process',
          message: `任务 ${taskId} 不在当前安装计划中。`,
          userAction: '请返回安装计划页面重新开始安装。'
        },
        status: 'failed'
      }
    }

    return browserInstallerClient.startInstall({
      ...browserSession.request,
      plan: {
        ...browserSession.request.plan,
        tasks: browserSession.request.plan.tasks.slice(index)
      }
    })
  },

  subscribeLogs(listener) {
    browserLogListeners.add(listener)

    return () => {
      browserLogListeners.delete(listener)
    }
  },

  async startInstall(input) {
    browserSession.request = input

    for (const task of input.plan.tasks) {
      emitBrowserLog({
        level: 'info',
        message: `开始执行：${task}`,
        taskId: task,
        type: 'task-start'
      })
      await Promise.resolve()
    }

    const result = await runPreviewInstall(input.plan, input.apiKey)

    result.logs.forEach((entry) => {
      emitBrowserLog({
        level: 'info',
        message: entry,
        taskId: input.plan.tasks.at(-1) ?? 'verify-codex-runtime',
        type: 'task-output'
      })
    })

    for (const task of input.plan.tasks) {
      emitBrowserLog({
        level: 'info',
        message: `已完成：${task}`,
        taskId: task,
        type: 'task-complete'
      })
      await Promise.resolve()
    }

    browserSession.diagnostics = renderBrowserDiagnostics(result.logs)
    return {
      codexVersion: result.version,
      configPath: result.configPath,
      keyMask: result.keyMask,
      logs: result.logs,
      status: 'ready' as const
    }
  },

  async validateApiKey(input) {
    return {
      message: isApiKeyValueValid(input)
        ? undefined
        : 'API Key 必须是以 sk- 开头，或为 64 位长度的 token。',
      ok: isApiKeyValueValid(input)
    }
  }
}

const browserLogListeners = new Set<(event: InstallLogEvent) => void>()

function emitBrowserLog(event: InstallLogEvent) {
  browserLogListeners.forEach((listener) => {
    listener(event)
  })
}

function renderBrowserDiagnostics(logs: string[]) {
  return [
    '# Codex 安装器诊断报告',
    '',
    '平台：browser-preview',
    '摘要：浏览器预览安装执行。',
    '',
    '日志：',
    ...logs.map((entry) => `- ${entry}`)
  ].join('\n')
}

function getIpcRendererApi(): RendererInstallerApi | null {
  if (typeof window === 'undefined' || typeof window.require !== 'function') {
    return null
  }

  try {
    const electronModule = window.require('electron') as {
      ipcRenderer?: {
        invoke(channel: string, ...args: unknown[]): Promise<unknown>
        on(channel: string, listener: (...args: unknown[]) => void): void
        removeListener(channel: string, listener: (...args: unknown[]) => void): void
      }
    }

    const ipcRenderer = electronModule.ipcRenderer

    if (!ipcRenderer) {
      return null
    }

    return {
      dismissRecoveryState: () =>
        ipcRenderer.invoke(ipcChannels.dismissRecoveryState) as Promise<void>,
      exportDiagnostics: () =>
        ipcRenderer.invoke(ipcChannels.exportDiagnostics) as Promise<string>,
      generatePlan: (input) =>
        ipcRenderer.invoke(ipcChannels.generatePlan, input) as Promise<InstallPlanData>,
      getAppInfo: () => ipcRenderer.invoke(ipcChannels.getAppInfo) as Promise<AppInfoData>,
      getDesktopAppState: () =>
        ipcRenderer.invoke(ipcChannels.getDesktopAppState) as Promise<DesktopAppStateData>,
      getRecoveryState: () =>
        ipcRenderer.invoke(ipcChannels.getRecoveryState) as Promise<RecoveryStateData>,
      loadEnvironment: () =>
        ipcRenderer.invoke(ipcChannels.loadEnvironment) as Promise<DetectionItemData[]>,
      openDesktopApp: () => ipcRenderer.invoke(ipcChannels.openDesktopApp) as Promise<boolean>,
      openDesktopAppInstall: () =>
        ipcRenderer.invoke(ipcChannels.openDesktopAppInstall) as Promise<boolean>,
      openProviderSite: () =>
        ipcRenderer.invoke(ipcChannels.openProviderSite) as Promise<boolean>,
      probeNetwork: () =>
        ipcRenderer.invoke(ipcChannels.probeNetwork) as Promise<NetworkProbeResult>,
      resumeInstall: () =>
        ipcRenderer.invoke(ipcChannels.resumeInstall) as Promise<InstallExecutionResult>,
      retryTask: (taskId) =>
        ipcRenderer.invoke(ipcChannels.retryTask, taskId) as Promise<InstallExecutionResult>,
      startInstall: (input) =>
        ipcRenderer.invoke(ipcChannels.startInstall, input) as Promise<InstallExecutionResult>,
      subscribeLogs: (listener) => {
        const wrappedListener = (_event: unknown, event: Parameters<typeof listener>[0]) => {
          listener(event)
        }

        ipcRenderer.on(ipcChannels.subscribeLogs, wrappedListener)

        return () => {
          ipcRenderer.removeListener(ipcChannels.subscribeLogs, wrappedListener)
        }
      },
      validateApiKey: (input) =>
        ipcRenderer.invoke(ipcChannels.validateApiKey, input) as Promise<ValidationResult>
    }
  } catch {
    return null
  }
}

export function getInstallerClient(): InstallerClient {
  if (typeof window !== 'undefined' && window.codexInstaller) {
    return window.codexInstaller
  }

  const ipcRendererClient = getIpcRendererApi()

  if (ipcRendererClient) {
    return ipcRendererClient
  }

  return browserInstallerClient
}
