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
      generatePlan: async () => ({
        summary: '在这台电脑上安装 Claude',
        tasks: ['install-claude', 'verify-claude-runtime']
      }),
      getAppInfo: async () => ({
        title: 'Claude 安装器',
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
          detail: '未安装 Claude Code CLI',
          id: 'claude',
          status: 'auto-fixable' as const,
          title: 'Claude Code CLI'
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
            message: 'Starting install-claude',
            taskId: 'install-claude',
            type: 'task-start'
          })
          logListener?.({
            level: 'info',
            message: 'npm install -g @anthropic-ai/claude-code',
            taskId: 'install-claude',
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

    expect(await screen.findByText('npm install -g @anthropic-ai/claude-code')).toBeInTheDocument()
    expect(screen.getByText('正在输出 安装 Claude Code CLI')).toBeInTheDocument()

    resolveInstall?.({
      claudeVersion: '0.1.0',
      configPath: 'C:\\Users\\Administrator\.claude\\config.toml',
      keyMask: 'sk-***key',
      logs: [
        'Starting install-claude',
        'npm install -g @anthropic-ai/claude-code',
        'Completed install-claude',
        'Starting verify-claude-runtime',
        'claude --version',
        'Completed verify-claude-runtime'
      ],
      status: 'ready'
    })

    expect(await screen.findByText('Claude 已可使用。')).toBeInTheDocument()
  })
})
