import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import App from '../../src/renderer/App'

describe('app failure flow', () => {
  afterEach(() => {
    cleanup()
  })

  it('stays on the execution screen with recovery guidance when installation fails', async () => {
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
              status: 'auto-fixable',
              title: 'Codex CLI'
            }
          ],
          openDesktopApp: async () => false,
          openDesktopAppInstall: async () => false,
          resumeInstall: async () => ({
            issue: {
              category: 'process',
              message: 'Resume unavailable in this test',
              userAction: 'Retry instead.'
            },
            status: 'failed'
          }),
          retryTask: async () => ({
            issue: {
              category: 'process',
              message: 'Retry unavailable in this test',
              userAction: 'Start a new installation.'
            },
            status: 'failed'
          }),
          subscribeLogs: () => () => {},
          startInstall: async () => ({
            issue: {
              category: 'network',
              message: 'Download failed',
              userAction: 'Retry after checking connectivity.'
            },
            status: 'failed'
          }),
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
    expect(screen.getByRole('button', { name: '重试当前步骤' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '继续安装' })).toBeInTheDocument()
  })
})
