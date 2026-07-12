import { useEffect, useState } from 'react'

import type { InstallPlan } from '../main/installer/plan'
import type {
  AppInfoData,
  DesktopAppStateData,
  DetectionItemData,
  InstallExecutionResult,
  InstallLogEvent
} from '../shared/ipc'
import type { ProviderId } from '../shared/provider-config'
import { DEFAULT_PROVIDER } from '../shared/provider-config'
import { getInstallerTaskLabel } from '../shared/task-labels'
import { ApiKeyStep } from './features/api-key/ApiKeyStep'
import { CompleteView } from './features/complete/CompleteView'
import {
  DetectionView,
  type DetectionItem
} from './features/detection/DetectionView'
import { ExecutionView } from './features/execution/ExecutionView'
import { PlanView } from './features/plan/PlanView'
import { RepairView } from './features/repair/RepairView'
import { RecoveryPrompt } from './features/recovery/RecoveryPrompt'
import { getInstallerClient, type InstallerClient } from './install-flow/client'

interface AppProps {
  installerClient?: InstallerClient
}

const fallbackPlan: InstallPlan = {
  summary: '在这台电脑上安装 Claude',
  tasks: ['install-node', 'install-claude', 'write-config']
}

const fallbackDesktopAppState: DesktopAppStateData = {
  displayName: 'Claude Desktop',
  downloadUrl: 'https://claude.ai/download',
  installed: false,
  statusMessage: '正在检查 Claude Desktop是否已安装。'
}

const fallbackAppInfo: AppInfoData = {
  title: 'Claude 安装器',
  version: 'unknown'
}

export default function App({ installerClient }: AppProps) {
  const client = installerClient ?? getInstallerClient()
  const [screen, setScreen] = useState<
    'api-key' | 'complete' | 'detection' | 'execution' | 'loading' | 'plan' | 'recovery' | 'repair'
  >('loading')
  const [appInfo, setAppInfo] = useState<AppInfoData>(fallbackAppInfo)
  const [plan, setPlan] = useState<InstallPlan | null>(null)
  const [apiKey, setApiKey] = useState('')
  const [provider, setProvider] = useState<ProviderId>(DEFAULT_PROVIDER)
  const [environmentItems, setEnvironmentItems] = useState<DetectionItem[]>([])
  const [executionState, setExecutionState] = useState({
    currentTask: '',
    failedTask: undefined as string | undefined,
    issueMessage: undefined as string | undefined,
    issueUserAction: undefined as string | undefined,
    logs: [] as string[],
    progressLabel: '准备安装'
  })
  const [completionState, setCompletionState] = useState({
    claudeVersion: '0.1.0',
    configPath: 'C:\\Users\\Administrator\.claude\\config.toml',
    keyMask: 'sk-***1234',
    status: 'ready' as const
  })
  const [desktopAppState, setDesktopAppState] = useState<DesktopAppStateData>(fallbackDesktopAppState)
  const [desktopAppActionLabel, setDesktopAppActionLabel] = useState<string | undefined>(undefined)
  const [repairState, setRepairState] = useState({
    category: 'process',
    likelyCause: undefined as string | undefined,
    message: '安装失败',
    userAction: '请重试安装流程。'
  })
  const [repairAction, setRepairAction] = useState<'export' | 'resume' | 'retry' | null>(null)
  const [diagnosticsReport, setDiagnosticsReport] = useState('')
  const [recoveryState, setRecoveryState] = useState({
    completedTasks: [] as string[],
    failedTaskId: undefined as string | undefined,
    lastFailureAt: undefined as string | undefined,
    pendingTasks: [] as string[],
    recentLogs: [] as string[],
    summary: undefined as string | undefined
  })

  useEffect(() => {
    let cancelled = false

    void client.getAppInfo().then((info) => {
      if (!cancelled) {
        setAppInfo(info)
      }
    })

    return () => {
      cancelled = true
    }
  }, [client])

  useEffect(() => {
    return client.subscribeLogs((event) => {
      setExecutionState((current) => ({
        currentTask: event.taskId,
        failedTask: event.type === 'task-failed' ? event.taskId : undefined,
        issueMessage: current.issueMessage,
        issueUserAction: current.issueUserAction,
        logs: [...current.logs, event.message],
        progressLabel: getProgressLabel(event)
      }))
    })
  }, [client])

  useEffect(() => {
    let cancelled = false

    void client.getRecoveryState().then((recovery) => {
      if (cancelled) {
        return
      }

      if (recovery.available) {
        setRecoveryState({
          completedTasks: recovery.completedTasks,
          failedTaskId: recovery.failedTaskId,
          lastFailureAt: recovery.lastFailureAt,
          pendingTasks: recovery.pendingTasks,
          recentLogs: recovery.recentLogs,
          summary: recovery.summary
        })
        setScreen('recovery')
        return
      }

      setScreen('api-key')
    })

    return () => {
      cancelled = true
    }
  }, [client])

  useEffect(() => {
    if (screen !== 'complete' || typeof client.getDesktopAppState !== 'function') {
      return
    }

    let cancelled = false
    setDesktopAppActionLabel(undefined)
    setDesktopAppState(fallbackDesktopAppState)

    void client.getDesktopAppState().then((state) => {
      if (!cancelled) {
        setDesktopAppState(state)
      }
    })

    return () => {
      cancelled = true
    }
  }, [client, screen])

  const versionBadge = (
    <div
      style={{
        position: 'fixed',
        top: 18,
        right: 28,
        zIndex: 50,
        borderRadius: '999px',
        border: '1px solid rgba(125, 211, 252, 0.24)',
        background: 'rgba(8, 20, 35, 0.88)',
        color: '#dbeafe',
        padding: '8px 12px',
        fontSize: '0.9rem',
        fontWeight: 700,
        letterSpacing: '0.02em'
      }}
    >
      {appInfo.title} v{appInfo.version}
    </div>
  )

  if (screen === 'loading') {
    return (
      <>
        {versionBadge}
        <section
          style={{
            minHeight: '100vh',
            display: 'grid',
            placeItems: 'center',
            background: '#08111f',
            color: '#eff6ff'
          }}
        >
          <p style={{ margin: 0 }}>正在检查是否存在中断的安装会话...</p>
        </section>
      </>
    )
  }

  if (screen === 'recovery') {
    return (
      <>
        {versionBadge}
        <RecoveryPrompt
          completedTasks={recoveryState.completedTasks}
          failedTaskId={recoveryState.failedTaskId}
          lastFailureAt={recoveryState.lastFailureAt}
          onDismiss={() => {
            void client.dismissRecoveryState().then(() => {
              setScreen('api-key')
            })
          }}
          onResume={() => {
            setExecutionState({
              currentTask: recoveryState.failedTaskId ?? recoveryState.pendingTasks[0] ?? 'install-claude',
              failedTask: undefined,
              issueMessage: undefined,
              issueUserAction: undefined,
              logs: [],
              progressLabel: '正在继续安装'
            })
            setScreen('execution')
            void client.resumeInstall().then((result) => {
              handleExecutionResult(result)
            })
          }}
          pendingTasks={recoveryState.pendingTasks}
          recentLogs={recoveryState.recentLogs}
          summary={recoveryState.summary}
        />
      </>
    )
  }

  if (screen === 'api-key') {
    return (
      <>
        {versionBadge}
        <ApiKeyStep
          existingKeyMask="sk-***1234"
          canReuseExistingKey
          onOpenProviderSite={() => {
            void client.openProviderSite()
          }}
          onContinue={({ apiKeyMode, keyValue, provider: chosenProvider }) => {
            setProvider(chosenProvider)
            const continueWithEnvironment = async () => {
              const environment = (await client.loadEnvironment()) as DetectionItemData[]
              const hasNode = environment.some(
                (item) => item.id === 'node' && item.status === 'satisfied'
              )
              const hasClaude = environment.some(
                (item) => item.id === 'claude' && item.status === 'satisfied'
              )
              const nextPlan = await client.generatePlan({
                apiKeyMode,
                claudeInstalled: hasClaude,
                nodeInstalled: hasNode
              })

              setApiKey(keyValue)
              setEnvironmentItems(environment)
              setPlan(nextPlan)
              setScreen('detection')
            }

            if (apiKeyMode === 'existing') {
              void continueWithEnvironment()
              return
            }

            void client.validateApiKey(keyValue).then(async (validation) => {
              if (!validation.ok) {
                return
              }

              await continueWithEnvironment()
            })
          }}
        />
      </>
    )
  }

  if (screen === 'detection') {
    return (
      <>
        {versionBadge}
        <DetectionView
          items={environmentItems}
          onContinue={() => {
            setScreen('plan')
          }}
        />
      </>
    )
  }

  if (screen === 'execution') {
    return (
      <>
        {versionBadge}
        <ExecutionView
          onOpenRepairGuide={() => {
            setScreen('repair')
          }}
          onResume={() => {
            beginResume()
          }}
          onRetryCurrentStep={() => {
            const taskId = executionState.failedTask ?? executionState.currentTask
            beginRetry(taskId)
          }}
          pendingAction={repairAction === 'resume' || repairAction === 'retry' ? repairAction : null}
          state={executionState}
        />
      </>
    )
  }

  if (screen === 'repair') {
    return (
      <>
        {versionBadge}
        <RepairView
          diagnosticsReport={diagnosticsReport}
          issue={repairState}
          onExportDiagnostics={() => {
            setRepairAction('export')
            void client.exportDiagnostics().then((report) => {
              setDiagnosticsReport(report)
              setRepairAction(null)
            })
          }}
          onResume={() => {
            beginResume()
          }}
          onRetryCurrentStep={() => {
            const taskId = executionState.failedTask ?? executionState.currentTask
            beginRetry(taskId)
          }}
          pendingAction={repairAction}
        />
      </>
    )
  }

  if (screen === 'complete') {
    return (
      <>
        {versionBadge}
        <CompleteView
          actionLabel={desktopAppActionLabel}
          desktopApp={desktopAppState}
          onInstallDesktopApp={() => {
            setDesktopAppActionLabel('正在打开安装页面...')
            void client
              .openDesktopAppInstall()
              .then((opened) => {
                setDesktopAppActionLabel(undefined)
                setDesktopAppState((current) => ({
                  ...current,
                  statusMessage: opened
                    ? '已打开 Claude Desktop安装页面。若浏览器未弹出，请手动访问 https://claude.ai/download'
                    : '打开安装页面失败，请手动访问 https://claude.ai/download'
                }))
              })
              .catch(() => {
                setDesktopAppActionLabel(undefined)
                setDesktopAppState((current) => ({
                  ...current,
                  statusMessage: '打开安装页面失败，请手动访问 https://claude.ai/download'
                }))
              })
          }}
          onOpenDesktopApp={() => {
            setDesktopAppActionLabel('正在打开桌面版...')
            void client
              .openDesktopApp()
              .then((opened) => {
                setDesktopAppActionLabel(undefined)
                setDesktopAppState((current) => ({
                  ...current,
                  statusMessage: opened
                    ? '已尝试启动 Claude Desktop。'
                    : '启动 Claude Desktop失败，请手动打开已安装的应用。'
                }))
              })
              .catch(() => {
                setDesktopAppActionLabel(undefined)
                setDesktopAppState((current) => ({
                  ...current,
                  statusMessage: '启动 Claude Desktop失败，请手动打开已安装的应用。'
                }))
              })
          }}
          onOpenProviderSite={() => {
            void client.openProviderSite()
          }}
          summary={completionState}
        />
      </>
    )
  }

  return (
    <>
      {versionBadge}
      <PlanView
        plan={plan ?? fallbackPlan}
        onStart={async () => {
          const activePlan = plan ?? fallbackPlan

          setExecutionState({
            currentTask: activePlan.tasks[0] ?? 'install-claude',
            failedTask: undefined,
            issueMessage: undefined,
            issueUserAction: undefined,
            logs: [],
            progressLabel: '准备安装'
          })
          setDiagnosticsReport('')
          setScreen('execution')

          const result = (await client.startInstall({
            apiKey,
            plan: activePlan,
            provider
          })) as InstallExecutionResult

          handleExecutionResult(result)
        }}
      />
    </>
  )

  function handleExecutionResult(result: InstallExecutionResult) {
    if (result.status === 'failed') {
      setExecutionState((current) => ({
        currentTask: current.currentTask || plan?.tasks.at(-1) || 'verify-claude-runtime',
        failedTask: current.failedTask ?? current.currentTask ?? 'verify-claude-runtime',
        issueMessage: result.issue.message,
        issueUserAction: result.issue.userAction,
        logs: mergeLogs(current.logs, result.logs),
        progressLabel: '安装失败'
      }))
      setRepairState({
        category: result.issue.category,
        likelyCause: result.issue.likelyCause,
        message: result.issue.message,
        userAction: result.issue.userAction
      })
      setScreen('execution')
      setRepairAction(null)
      return
    }

    setExecutionState((current) => ({
      currentTask: plan?.tasks.at(-1) ?? 'verify-claude-runtime',
      failedTask: undefined,
      issueMessage: undefined,
      issueUserAction: undefined,
      logs: mergeLogs(current.logs, result.logs),
      progressLabel: '安装完成'
    }))
    setCompletionState({
      claudeVersion: result.claudeVersion,
      configPath: result.configPath,
      keyMask: result.keyMask,
      status: 'ready'
    })
    setDesktopAppActionLabel(undefined)
    setDesktopAppState(fallbackDesktopAppState)
    setScreen('complete')
    setRepairAction(null)
  }

  function beginResume() {
    setRepairAction('resume')
    setExecutionState({
      currentTask: executionState.failedTask ?? executionState.currentTask,
      failedTask: undefined,
      issueMessage: undefined,
      issueUserAction: undefined,
      logs: [],
      progressLabel: '正在继续安装'
    })
    setScreen('execution')
    void client.resumeInstall().then((result) => {
      handleExecutionResult(result)
    })
  }

  function beginRetry(taskId: string) {
    setRepairAction('retry')
    setExecutionState({
      currentTask: taskId,
      failedTask: undefined,
      issueMessage: undefined,
      issueUserAction: undefined,
      logs: [],
      progressLabel: `正在重试 ${getInstallerTaskLabel(taskId)}`
    })
    setScreen('execution')
    void client.retryTask(taskId).then((result) => {
      handleExecutionResult(result)
    })
  }
}

function getProgressLabel(event: InstallLogEvent) {
  const taskLabel = getInstallerTaskLabel(event.taskId)

  switch (event.type) {
    case 'task-complete':
      return event.taskId === 'verify-claude-runtime' ? '安装完成' : `已完成 ${taskLabel}`
    case 'task-failed':
      return '安装失败'
    case 'task-start':
      return `正在执行 ${taskLabel}`
    default:
      return `正在输出 ${taskLabel}`
  }
}

function mergeLogs(existing: string[], incoming?: string[]) {
  return [...new Set([...existing, ...(incoming ?? [])])]
}
