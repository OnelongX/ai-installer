import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { InstallLogEvent } from '../../src/shared/ipc'
import App from '../../src/renderer/App'

describe('app execution stream', () => {
  afterEach(() => {
    cleanup()
  })

  it('shows streamed install logs before completion', async () => {
    let resolveInstall: ((value: Awaited<ReturnType<NonNullable<typeof client.startInstall>>>) => void) | null =
      null
    let logListener: ((event: InstallLogEvent) => void) | null = null

    const client = {
      dismissRecoveryState: async () => {},
      exportDiagnostics: async () => '',
      getExistingApiKey: async () => ({ exists: false as const }),
      probeNetwork: async () => ({ internalReachable: false, resolvedBaseUrl: "https://ai-api.solaeon.com", network: "external" as const }),
      generatePlan: async () => ({
        summary: '在这台电脑上安装 Codex',
        tasks: ['install-codex', 'verify-codex-runtime']
      }),
      getAppInfo: async () => ({
        title: 'Codex 安装器',
        version: '0.1.2'
      }),
      getRecoveryState: async () => ({
        available: false,
        completedTasks: [],
        pendingTasks: [],
        recentLogs: [],
        summary: '未发现未完成的安装会话。'
      }),
      loadEnvironment: async () => [
        {
          detail: '未安装 Codex CLI',
          id: 'codex',
          status: 'auto-fixable' as const,
          title: 'Codex CLI'
        }
      ],
      openDesktopApp: async () => false,
      openDesktopAppInstall: async () => false,
      resumeInstall: async () => ({
        issue: {
          category: 'process',
          message: 'Resume should not run in this test',
          userAction: 'Start a new installation.'
        },
        status: 'failed' as const
      }),
      retryTask: async () => ({
        issue: {
          category: 'process',
          message: 'Retry should not run in this test',
          userAction: 'Start a new installation.'
        },
        status: 'failed' as const
      }),
      startInstall: () =>
        new Promise((resolve) => {
          logListener?.({
            level: 'info',
            message: 'Starting install-codex',
            taskId: 'install-codex',
            type: 'task-start'
          })
          logListener?.({
            level: 'info',
            message: 'npm install -g @openai/codex',
            taskId: 'install-codex',
            type: 'task-output'
          })
          resolveInstall = resolve
        }),
      subscribeLogs: (listener: (event: InstallLogEvent) => void) => {
        logListener = listener

        return () => {
          logListener = null
        }
      },
      validateApiKey: async () => ({ ok: true })
    }

    render(<App installerClient={client} />)

    fireEvent.click(await screen.findByRole('button', { name: /输入新的 Key/i }))
    fireEvent.change(screen.getByLabelText('API Key'), {
      target: { value: 'sk-test-key' }
    })
    fireEvent.click(screen.getByRole('button', { name: '继续' }))
    expect(await screen.findByText('环境检测')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '继续到安装计划' }))
    fireEvent.click(screen.getByRole('button', { name: '开始安装' }))

    expect(await screen.findByText('npm install -g @openai/codex')).toBeInTheDocument()
    expect(screen.getByText('正在输出 安装 Codex CLI')).toBeInTheDocument()

    resolveInstall?.({
      codexVersion: '0.1.0',
      configPath: 'C:\\Users\\Administrator\\.codex\\config.toml',
      keyMask: 'sk-***key',
      logs: [
        'Starting install-codex',
        'npm install -g @openai/codex',
        'Completed install-codex',
        'Starting verify-codex-runtime',
        'codex --version',
        'Completed verify-codex-runtime'
      ],
      status: 'ready'
    })

    expect(await screen.findByText('Codex 已可使用。')).toBeInTheDocument()
  })
})
