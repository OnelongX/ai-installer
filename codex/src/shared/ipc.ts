import type { NetworkMode, ProviderId } from './provider-config'

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
  codexInstalled: boolean
  nodeInstalled: boolean
}

export interface StartInstallRequest {
  apiKey: string
  plan: InstallPlanData
  /** which model provider to write into config.toml (default: livetoken) */
  provider?: ProviderId
  /** for solaeon: auto probes the LAN, internal/external force one address */
  networkMode?: NetworkMode
  /** model id written to config.toml (default: gpt-5.5) */
  model?: string
}

export interface NetworkProbeResult {
  /** true when the Solaeon LAN box (192.168.1.101:48760) answered a TCP connect */
  internalReachable: boolean
  /** the base_url that `auto` mode would pick right now */
  resolvedBaseUrl: string
  network: 'internal' | 'external'
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
  codexVersion: string
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
  probeNetwork: 'installer:probe-network',
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
  probeNetwork(): Promise<NetworkProbeResult>
  validateApiKey(input: string): Promise<ValidationResult>
  generatePlan(input: GeneratePlanRequest): Promise<InstallPlanData>
  getExistingApiKey(): Promise<ExistingApiKeyResult>
  startInstall(input: StartInstallRequest): Promise<InstallExecutionResult>
  subscribeLogs(listener: (event: InstallLogEvent) => void): () => void
  retryTask(taskId: string): Promise<InstallExecutionResult>
  resumeInstall(): Promise<InstallExecutionResult>
  exportDiagnostics(): Promise<string>
}
