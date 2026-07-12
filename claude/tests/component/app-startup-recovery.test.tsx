import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from '../../src/renderer/App'

describe('app startup recovery', () => {
  afterEach(() => {
    cleanup()
  })

  it('shows a recovery prompt when an interrupted session exists and can dismiss it', async () => {
    const dismissRecoveryState = vi.fn(async () => {})

    render(
      <App
        installerClient={{
          dismissRecoveryState,
          exportDiagnostics: async () => '',
          generatePlan: async () => ({
            summary: '在这台电脑上安装 Claude',
            tasks: ['install-claude']
          }),
          getAppInfo: async () => ({
            title: 'Claude 安装器',
            version: '0.1.2'
          }),
          getDesktopAppState: async () => ({
            displayName: 'Claude Desktop',
            downloadUrl: 'https://claude.ai/download',
            installed: false,
            statusMessage: '未检测到 Claude Desktop。'
          }),
          getRecoveryState: async () => ({
            available: true,
            completedTasks: ['write-config'],
            failedTaskId: 'install-claude',
            lastFailureAt: '2026-04-23T09:30:00.000Z',
            pendingTasks: ['install-claude', 'verify-claude-runtime'],
            recentLogs: ['Write C:\\Users\\Administrator\.claude\\config.toml', 'network timed out'],
            summary: '上一次安装在下载 Claude 时中断。'
          }),
          loadEnvironment: async () => [],
          openDesktopApp: async () => false,
          openDesktopAppInstall: async () => true,
          resumeInstall: async () => ({
            claudeVersion: '0.1.0',
            configPath: 'C:\\Users\\Administrator\.claude\\config.toml',
            keyMask: 'sk-***key',
            logs: ['Completed install-claude'],
            status: 'ready'
          }),
          retryTask: async () => ({
            issue: {
              category: 'process',
              message: 'Retry should not run in this test',
              userAction: 'Resume instead.'
            },
            status: 'failed'
          }),
          startInstall: async () => ({
            claudeVersion: '0.1.0',
            configPath: 'C:\\Users\\Administrator\.claude\\config.toml',
            keyMask: 'sk-***key',
            logs: [],
            status: 'ready'
          }),
          subscribeLogs: () => () => {},
          validateApiKey: async () => ({ ok: true })
        }}
      />
    )

    expect(await screen.findByText('检测到未完成的 Claude 安装。')).toBeInTheDocument()
    expect(screen.getByText('上次失败任务：')).toBeInTheDocument()
    expect(screen.getByText('安装 Claude Code CLI')).toBeInTheDocument()
    expect(screen.getByText('已完成任务：')).toBeInTheDocument()
    expect(screen.getByText('写入 Claude Code 配置')).toBeInTheDocument()
    expect(screen.getByText('待执行任务：')).toBeInTheDocument()
    expect(screen.getByText('安装 Claude Code CLI, 验证 Claude 运行环境')).toBeInTheDocument()
    expect(screen.getByText('诊断预览')).toBeInTheDocument()
    expect(screen.getByText('network timed out')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '重新开始' }))

    expect(dismissRecoveryState).toHaveBeenCalled()
    expect(await screen.findByRole('button', { name: /输入新的 Key/i })).toBeInTheDocument()
  })
})
