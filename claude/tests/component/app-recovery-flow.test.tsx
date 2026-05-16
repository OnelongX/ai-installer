import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from '../../src/renderer/App'

describe('app recovery flow', () => {
  afterEach(() => {
    cleanup()
  })

  it('exports diagnostics and retries from the repair screen', async () => {
    const retryTask = vi.fn(async () => ({
      claudeVersion: '0.1.0',
      configPath: 'C:\\Users\\Administrator\.claude\\config.toml',
      keyMask: 'sk-***key',
      logs: ['Retrying from install-claude', 'Completed install-claude'],
      status: 'ready' as const
    }))

    render(
      <App
        installerClient={{
          dismissRecoveryState: async () => {},
          exportDiagnostics: async () =>
            ['# Claude 安装器诊断报告', '', '日志：', '- network timed out'].join('\n'),
          generatePlan: async () => ({
            summary: '在这台电脑上安装 Claude',
            tasks: ['install-claude']
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
              status: 'auto-fixable',
              title: 'Claude Code CLI'
            }
          ],
          openDesktopApp: async () => false,
          openDesktopAppInstall: async () => false,
          resumeInstall: async () => ({
            issue: {
              category: 'process',
              message: 'Resume should not run in this test',
              userAction: 'Retry instead.'
            },
            status: 'failed'
          }),
          retryTask,
          startInstall: async () => ({
            issue: {
              category: 'network',
              message: 'Download failed',
              userAction: 'Retry after checking connectivity.'
            },
            logs: ['npm install -g @anthropic-ai/claude-code'],
            status: 'failed'
          }),
          subscribeLogs: () => () => {},
          validateApiKey: async () => ({ ok: true })
        }}
      />
    )

    fireEvent.click(await screen.findByRole('button', { name: /输入新的 Key/i }))
    fireEvent.change(screen.getByLabelText('API Key'), {
      target: { value: 'sk-test-key' }
    })
    fireEvent.click(screen.getByRole('button', { name: '继续' }))
    expect(await screen.findByText('环境检测')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '继续到安装计划' }))
    fireEvent.click(screen.getByRole('button', { name: '开始安装' }))

    expect(await screen.findByText('Download failed')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '查看修复指引' }))

    fireEvent.click(screen.getByRole('button', { name: '导出诊断报告' }))
    expect(
      await screen.findByText('# Claude 安装器诊断报告', { exact: false })
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '重试失败步骤' }))

    expect(retryTask).toHaveBeenCalledWith('install-claude')
    expect(await screen.findByText('Claude 已可使用。')).toBeInTheDocument()
  })
})
