import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from '../../src/renderer/App'

describe('app complete desktop app actions', () => {
  afterEach(() => {
    cleanup()
  })

  it('updates the completion status after opening the desktop app install page', async () => {
    const openDesktopAppInstall = vi.fn(async () => true)

    render(
      <App
        installerClient={{
          dismissRecoveryState: async () => {},
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
            available: false,
            completedTasks: [],
            pendingTasks: [],
            recentLogs: []
          }),
          loadEnvironment: async () => [
            {
              detail: '已安装 Node.js',
              id: 'node',
              status: 'satisfied',
              title: 'Node.js'
            },
            {
              detail: '已安装 Claude Code CLI',
              id: 'claude',
              status: 'satisfied',
              title: 'Claude Code CLI'
            }
          ],
          openDesktopApp: async () => false,
          openDesktopAppInstall,
          resumeInstall: async () => ({
            claudeVersion: '0.1.0',
            configPath: 'C:\\Users\\Administrator\.claude\\config.toml',
            keyMask: 'sk-***key',
            logs: [],
            status: 'ready'
          }),
          retryTask: async () => ({
            issue: {
              category: 'process',
              message: 'Unexpected retry',
              userAction: 'Do not retry in this test.'
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

    expect(await screen.findByText('Claude 安装器 v0.1.2')).toBeInTheDocument()

    fireEvent.click(await screen.findByRole('button', { name: /输入新的 Key/i }))
    fireEvent.change(screen.getByLabelText('API Key'), { target: { value: 'sk-test-key' } })
    fireEvent.click(screen.getByRole('button', { name: '继续' }))
    fireEvent.click(await screen.findByRole('button', { name: '继续到安装计划' }))
    fireEvent.click(screen.getByRole('button', { name: '开始安装' }))

    expect(await screen.findByText('Claude 已可使用。')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '前往安装 Claude Desktop' }))

    expect(openDesktopAppInstall).toHaveBeenCalledTimes(1)
    expect(
      await screen.findByText(
        '已打开 Claude Desktop安装页面。若浏览器未弹出，请手动访问 https://claude.ai/download'
      )
    ).toBeInTheDocument()
  })
})
