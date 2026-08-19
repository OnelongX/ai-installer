import { renderDiagnosticReport } from '../diagnostics/export'
import { createInstallerService } from './service'

import type {
  DetectionItemData,
  GeneratePlanRequest,
  InstallExecutionResult,
  InstallLogEvent,
  RecoveryStateData,
  StartInstallRequest,
  ValidationResult
} from '../../shared/ipc'

type ExecResult = {
  exitCode: number
  stderr: string
  stdout: string
}

interface ExecOptions {
  timeoutMs?: number
}

interface InstallSessionControllerDeps {
  appVersion: string
  clearSession(): Promise<void>
  exec(command: string, args?: string[], options?: ExecOptions): Promise<ExecResult>
  fileExists(path: string): Promise<boolean>
  loadSession(): Promise<string | null>
  mkdir(path: string): Promise<void>
  platform: string
  saveSession(serialized: string): Promise<void>
  userProfile: string
  writeFile(path: string, value: string): Promise<void>
}

interface InstallSessionState {
  appVersion?: string
  completedTasks: string[]
  failedTaskId?: string
  lastFailureAt?: string
  logs: string[]
  request?: StartInstallRequest
  summary: string
  updatedAt?: string
}

function createDefaultState(): InstallSessionState {
  return {
    completedTasks: [],
    logs: [],
    summary: '当前还没有可导出的诊断数据。'
  }
}

export function createInstallSessionController(deps: InstallSessionControllerDeps) {
  const sharedService = createInstallerService({
    exec: deps.exec,
    fileExists: deps.fileExists,
    mkdir: deps.mkdir,
    userProfile: deps.userProfile,
    writeFile: deps.writeFile
  })

  const state: InstallSessionState = createDefaultState()
  let hydratePromise: Promise<void> | null = null

  async function ensureHydrated() {
    if (!hydratePromise) {
      hydratePromise = (async () => {
        const serialized = await deps.loadSession()

        if (!serialized) {
          return
        }

        try {
          const parsed = JSON.parse(serialized) as InstallSessionState

          if (!parsed.appVersion || parsed.appVersion !== deps.appVersion) {
            await deps.clearSession()
            return
          }

          state.completedTasks = Array.isArray(parsed.completedTasks) ? parsed.completedTasks : []
          state.failedTaskId = parsed.failedTaskId
          state.lastFailureAt = parsed.lastFailureAt
          state.logs = Array.isArray(parsed.logs) ? parsed.logs : []
          state.request = parsed.request
          state.summary =
            typeof parsed.summary === 'string'
              ? parsed.summary
              : '已恢复上一次安装会话。'
          state.updatedAt = parsed.updatedAt
        } catch {
          await deps.clearSession()
        }
      })()
    }

    await hydratePromise
  }

  async function persistState() {
    if (!state.request) {
      await deps.clearSession()
      return
    }

    state.updatedAt = new Date().toISOString()
    await deps.saveSession(
      JSON.stringify({
        appVersion: deps.appVersion,
        completedTasks: state.completedTasks,
        failedTaskId: state.failedTaskId,
        lastFailureAt: state.lastFailureAt,
        logs: state.logs,
        request: state.request,
        summary: state.summary,
        updatedAt: state.updatedAt
      })
    )
  }

  async function resetSession(request: StartInstallRequest) {
    state.completedTasks = []
    state.failedTaskId = undefined
    state.lastFailureAt = undefined
    state.logs = []
    state.request = request
    state.summary = '安装进行中。'
    await persistState()
  }

  function appendLog(message: string) {
    state.logs.push(message)
  }

  async function execute(
    request: StartInstallRequest,
    tasks: string[],
    emitLog?: (event: InstallLogEvent) => void
  ): Promise<InstallExecutionResult> {
    const service = createInstallerService({
      exec: deps.exec,
      fileExists: deps.fileExists,
      mkdir: deps.mkdir,
      onLog: async (event) => {
        appendLog(event.message)
        if (event.type === 'task-complete' && !state.completedTasks.includes(event.taskId)) {
          state.completedTasks.push(event.taskId)
        }
        if (event.type === 'task-failed') {
          state.failedTaskId = event.taskId
          state.lastFailureAt = new Date().toISOString()
        }
        await persistState()
        emitLog?.(event)
      },
      userProfile: deps.userProfile,
      writeFile: deps.writeFile
    })

    const result = await service.startInstall({
      ...request,
      plan: {
        ...request.plan,
        tasks
      }
    })

    if (result.status === 'ready') {
      state.failedTaskId = undefined
      state.lastFailureAt = undefined
      state.summary = `Codex ${result.codexVersion} 安装成功。`
      state.request = undefined
      await persistState()
    } else {
      state.summary = result.issue.message
      await persistState()
    }

    return result
  }

  function getPendingTasks() {
    if (!state.request) {
      return []
    }

    return state.request.plan.tasks.filter((taskId) => !state.completedTasks.includes(taskId))
  }

  return {
    async dismissRecoveryState() {
      await ensureHydrated()
      state.completedTasks = []
      state.failedTaskId = undefined
      state.lastFailureAt = undefined
      state.logs = []
      state.request = undefined
      state.summary = '当前还没有可导出的诊断数据。'
      state.updatedAt = undefined
      await deps.clearSession()
    },

    async exportDiagnostics() {
      await ensureHydrated()
      return renderDiagnosticReport({
        logs: state.logs,
        platform: deps.platform,
        summary: state.summary
      })
    },

    loadEnvironment(): Promise<DetectionItemData[]> {
      return sharedService.loadEnvironment()
    },

    probeNetwork() {
      return sharedService.probeNetwork()
    },

    listModels(input: Parameters<typeof sharedService.listModels>[0]) {
      return sharedService.listModels(input)
    },

    syncModels(input: Parameters<typeof sharedService.syncModels>[0]) {
      return sharedService.syncModels(input)
    },

    getExistingApiKey() {
      return sharedService.getExistingApiKey()
    },

    generatePlan(input: GeneratePlanRequest) {
      return sharedService.generatePlan(input)
    },

    async getRecoveryState(): Promise<RecoveryStateData> {
      await ensureHydrated()

      const pendingTasks = getPendingTasks()

      if (!state.request || pendingTasks.length === 0) {
        return {
          available: false,
          completedTasks: [],
          pendingTasks: [],
          recentLogs: [],
          summary: '未发现未完成的安装会话。'
        }
      }

      return {
        available: true,
        completedTasks: state.completedTasks,
        failedTaskId: state.failedTaskId,
        lastFailureAt: state.lastFailureAt,
        pendingTasks,
        recentLogs: state.logs.slice(-3),
        summary: state.summary
      }
    },

    async resumeInstall(emitLog?: (event: InstallLogEvent) => void) {
      await ensureHydrated()

      if (!state.request) {
        return {
          issue: {
            category: 'process',
            message: '没有可继续的历史安装会话。',
            userAction: '请返回安装计划页面重新开始安装。'
          },
          status: 'failed' as const
        }
      }

      const tasks = getPendingTasks()

      if (tasks.length === 0) {
        return {
          issue: {
            category: 'process',
            message: '当前没有可继续的待执行任务。',
            userAction: '如果你想重新跑一遍流程，请开始新的安装。'
          },
          status: 'failed' as const
        }
      }

      appendLog(`继续执行：${tasks[0]}`)
      await persistState()
      return execute(state.request, tasks, emitLog)
    },

    async retryTask(taskId: string, emitLog?: (event: InstallLogEvent) => void) {
      await ensureHydrated()

      if (!state.request) {
        return {
          issue: {
            category: 'process',
            message: '当前没有可用于重试的安装会话。',
            userAction: '请返回安装计划页面重新开始安装。'
          },
          status: 'failed' as const
        }
      }

      const taskIndex = state.request.plan.tasks.indexOf(taskId)

      if (taskIndex === -1) {
        return {
          issue: {
            category: 'process',
            message: `任务 ${taskId} 不在当前安装计划中。`,
            userAction: '请返回安装计划页面重新开始安装。'
          },
          status: 'failed' as const
        }
      }

      state.completedTasks = state.completedTasks.filter((completedTaskId) => {
        const completedIndex = state.request?.plan.tasks.indexOf(completedTaskId) ?? -1
        return completedIndex > -1 && completedIndex < taskIndex
      })
      state.failedTaskId = undefined
      appendLog(`重新执行：${taskId}`)
      await persistState()

      return execute(state.request, state.request.plan.tasks.slice(taskIndex), emitLog)
    },

    async startInstall(
      request: StartInstallRequest,
      emitLog?: (event: InstallLogEvent) => void
    ): Promise<InstallExecutionResult> {
      await ensureHydrated()
      await resetSession(request)
      return execute(request, request.plan.tasks, emitLog)
    },

    validateApiKey(input: string): Promise<ValidationResult> {
      return sharedService.validateApiKey(input)
    }
  }
}
