import type {
  DeleteGatewayProfileResult,
  GatewayProfilesState,
  SaveGatewayProfileRequest,
  SaveGatewayProfileResult,
  SwitchGatewayRequest,
  SwitchGatewayResult
} from './gateway-switch'
import type { GatewayModel } from './models'
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
  /** which model provider to write into config.toml (default: solaeon) */
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

export interface ListModelsRequest {
  /** optional: SolaEon lists its models without a key */
  apiKey?: string
  provider?: ProviderId
  networkMode?: NetworkMode
}

export interface ListModelsResult {
  /** models the gateway reported (empty → caller keeps its fallback list) */
  models: GatewayModel[]
}

export interface SyncModelsRequest {
  /** falls back to the OPENAI_API_KEY env var when omitted */
  apiKey?: string
  provider?: ProviderId
  networkMode?: NetworkMode
  /** use a saved 切换网关 profile (its gateway + encrypted key) instead */
  profileId?: string
}

export interface SyncModelsResult {
  ok: boolean
  /** total models written to models-catalog.json */
  count: number
  /** how many came from the live gateway (rest are EXTRA_MODELS) */
  gatewayCount?: number
  /** absolute path of the catalog file */
  path: string
  /** set when ok is false */
  message?: string
  /** config.toml doesn't route Codex through the gateway catalog, so nothing was written */
  notWired?: boolean
}

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
  probeNetwork: 'installer:probe-network',
  listModels: 'installer:list-models',
  syncModels: 'installer:sync-models',
  resumeInstall: 'installer:resume',
  retryTask: 'installer:retry-task',
  startInstall: 'installer:start',
  subscribeLogs: 'installer:subscribe-logs',
  validateApiKey: 'installer:validate-api-key',
  listGatewayProfiles: 'installer:list-gateway-profiles',
  saveGatewayProfile: 'installer:save-gateway-profile',
  deleteGatewayProfile: 'installer:delete-gateway-profile',
  switchGateway: 'installer:switch-gateway'
} as const

export interface RendererInstallerApi {
  dismissRecoveryState(): Promise<void>
  getAppInfo(): Promise<AppInfoData>
  getDesktopAppState(): Promise<DesktopAppStateData>
  getRecoveryState(): Promise<RecoveryStateData>
  loadEnvironment(): Promise<DetectionItemData[]>
  openDesktopApp(): Promise<boolean>
  openDesktopAppInstall(): Promise<boolean>
  probeNetwork(): Promise<NetworkProbeResult>
  listModels(input: ListModelsRequest): Promise<ListModelsResult>
  syncModels(input: SyncModelsRequest): Promise<SyncModelsResult>
  validateApiKey(input: string): Promise<ValidationResult>
  generatePlan(input: GeneratePlanRequest): Promise<InstallPlanData>
  getExistingApiKey(): Promise<ExistingApiKeyResult>
  startInstall(input: StartInstallRequest): Promise<InstallExecutionResult>
  subscribeLogs(listener: (event: InstallLogEvent) => void): () => void
  retryTask(taskId: string): Promise<InstallExecutionResult>
  resumeInstall(): Promise<InstallExecutionResult>
  exportDiagnostics(): Promise<string>
  listGatewayProfiles(): Promise<GatewayProfilesState>
  saveGatewayProfile(input: SaveGatewayProfileRequest): Promise<SaveGatewayProfileResult>
  deleteGatewayProfile(id: string): Promise<DeleteGatewayProfileResult>
  switchGateway(input: SwitchGatewayRequest): Promise<SwitchGatewayResult>
}
