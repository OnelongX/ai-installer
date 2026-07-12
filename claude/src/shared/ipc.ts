import type { ProviderId } from './provider-config'

export interface DetectionItemData {
  command?: string
  detail: string
  id: string
  observedOutput?: string
  status: 'auto-fixable' | 'manual-action' | 'satisfied' | 'skipped'
  title: string
}

export interface InstallPlanData {
  summary: string
  tasks: string[]
}

export interface GeneratePlanRequest {
  apiKeyMode: 'existing' | 'session' | 'user-env'
  claudeInstalled: boolean
  nodeInstalled: boolean
}

export interface StartInstallRequest {
  apiKey: string
  plan: InstallPlanData
  /** which gateway to configure (default: solaeon) */
  provider?: ProviderId
}

export type ExistingApiKeyResult =
  | { exists: false }
  | { exists: true; mask: string }

export interface ValidationResult {
  message?: string
  ok: boolean
}

export interface RecoveryStateData {
  available: boolean
  completedTasks: string[]
  failedTaskId?: string
  lastFailureAt?: string
  pendingTasks: string[]
  recentLogs: string[]
  summary?: string
}

export interface DesktopAppStateData {
  displayName: string
  downloadUrl: string
  installed: boolean
  launchPath?: string
  statusMessage: string
}

export interface AppInfoData {
  title: string
  version: string
}

export interface InstallLogEvent {
  level: 'error' | 'info'
  message: string
  taskId: string
  type: 'task-complete' | 'task-failed' | 'task-output' | 'task-start'
}

export interface InstallSuccessResult {
  claudeVersion: string
  configPath: string
  keyMask: string
  logs: string[]
  status: 'ready'
}

export interface InstallFailureResult {
  issue: {
    category: string
    likelyCause?: string
    message: string
    userAction?: string
  }
  logs?: string[]
  status: 'failed'
}

export type InstallExecutionResult = InstallFailureResult | InstallSuccessResult

export const providerSiteUrl = 'https://livetoken.top/'
export const providerDisplayName = 'LiveToken'

export const ipcChannels = {
  getAppInfo: 'installer:get-app-info',
  getDesktopAppState: 'installer:get-desktop-app-state',
  dismissRecoveryState: 'installer:dismiss-recovery-state',
  exportDiagnostics: 'installer:export-diagnostics',
  generatePlan: 'installer:generate-plan',
  getExistingApiKey: 'installer:get-existing-api-key',
  getRecoveryState: 'installer:get-recovery-state',
  loadEnvironment: 'installer:load-environment',
  openDesktopApp: 'installer:open-desktop-app',
  openDesktopAppInstall: 'installer:open-desktop-app-install',
  openProviderSite: 'installer:open-provider-site',
  resumeInstall: 'installer:resume',
  retryTask: 'installer:retry-task',
  startInstall: 'installer:start',
  subscribeLogs: 'installer:subscribe-logs',
  validateApiKey: 'installer:validate-api-key'
} as const

export interface RendererInstallerApi {
  dismissRecoveryState(): Promise<void>
  getAppInfo(): Promise<AppInfoData>
  getDesktopAppState(): Promise<DesktopAppStateData>
  getRecoveryState(): Promise<RecoveryStateData>
  loadEnvironment(): Promise<DetectionItemData[]>
  openDesktopApp(): Promise<boolean>
  openDesktopAppInstall(): Promise<boolean>
  openProviderSite(): Promise<boolean>
  validateApiKey(input: string): Promise<ValidationResult>
  generatePlan(input: GeneratePlanRequest): Promise<InstallPlanData>
  getExistingApiKey(): Promise<ExistingApiKeyResult>
  startInstall(input: StartInstallRequest): Promise<InstallExecutionResult>
  subscribeLogs(listener: (event: InstallLogEvent) => void): () => void
  retryTask(taskId: string): Promise<InstallExecutionResult>
  resumeInstall(): Promise<InstallExecutionResult>
  exportDiagnostics(): Promise<string>
}
