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
      getExistingApiKey: async () => ({ exists: false as const }),
      probeNetwork: async () => ({ internalReachable: false, resolvedBaseUrl: "https://ai-api.solaeon.com", network: "external" as const }),
          generatePlan: async () => ({
            summary: '在这台电脑上安装 Codex',
            tasks: ['install-codex']
          }),
          getAppInfo: async () => ({
            title: 'Codex 安装器',
            version: '0.1.2'
          }),
          getDesktopAppState: async () => ({
            displayName: 'Codex 桌面版',
            downloadUrl: 'https://openai.com/codex/get-started/',
            installed: false,
            statusMessage: '未检测到 Codex 桌面版。'
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
              detail: '已安装 Codex CLI',
              id: 'codex',
              status: 'satisfied',
              title: 'Codex CLI'
            }
          ],
          openDesktopApp: async () => false,
          openDesktopAppInstall,
          resumeInstall: async () => ({
            codexVersion: '0.1.0',
            configPath: 'C:\\Users\\Administrator\\.codex\\config.toml',
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
            codexVersion: '0.1.0',
            configPath: 'C:\\Users\\Administrator\\.codex\\config.toml',
            keyMask: 'sk-***key',
            logs: [],
            status: 'ready'
          }),
          subscribeLogs: () => () => {},
          validateApiKey: async () => ({ ok: true })
        }}
      />
    )

    expect(await screen.findByText('Codex 安装器 v0.1.2')).toBeInTheDocument()

    fireEvent.click(await screen.findByRole('button', { name: /输入新的 Key/i }))
    fireEvent.change(screen.getByLabelText('API Key'), { target: { value: 'sk-test-key' } })
    fireEvent.click(screen.getByRole('button', { name: '继续' }))
    fireEvent.click(await screen.findByRole('button', { name: '继续到安装计划' }))
    fireEvent.click(screen.getByRole('button', { name: '开始安装' }))

    expect(await screen.findByText('Codex 已可使用。')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '前往安装 Codex 桌面版' }))

    expect(openDesktopAppInstall).toHaveBeenCalledTimes(1)
    expect(
      await screen.findByText(
        '已打开 Codex 桌面版安装页面。若浏览器未弹出，请手动访问 https://openai.com/codex/get-started/'
      )
    ).toBeInTheDocument()
  })
})
