import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { CompleteView } from '../../src/renderer/features/complete/CompleteView'

afterEach(() => {
  cleanup()
})

describe('complete view', () => {
  it('shows masked key information in the final summary', () => {
    render(
      <CompleteView
        desktopApp={{
          displayName: 'Codex 桌面版',
          installed: false,
          statusMessage: '未检测到 Codex 桌面版'
        }}
        onInstallDesktopApp={() => {}}
        onOpenDesktopApp={() => {}}
        summary={{
          codexVersion: '0.1.0',
          configPath: 'C:\\Users\\Administrator\\.codex\\config.toml',
          keyMask: 'sk-***1234',
          status: 'ready'
        }}
      />
    )

    expect(screen.getByText('sk-***1234')).toBeInTheDocument()
    expect(screen.getByText('0.1.0')).toBeInTheDocument()
  })

  it('shows an open button when the desktop app is installed', () => {
    const onOpenDesktopApp = vi.fn()

    render(
      <CompleteView
        desktopApp={{
          displayName: 'Codex 桌面版',
          installed: true,
          statusMessage: '已检测到 Codex 桌面版'
        }}
        onInstallDesktopApp={() => {}}
        onOpenDesktopApp={onOpenDesktopApp}
        summary={{
          codexVersion: '0.1.0',
          configPath: 'C:\\Users\\Administrator\\.codex\\config.toml',
          keyMask: 'sk-***1234',
          status: 'ready'
        }}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: '打开 Codex 桌面版' }))
    expect(onOpenDesktopApp).toHaveBeenCalledTimes(1)
  })

  it('shows an install button when the desktop app is missing', () => {
    const onInstallDesktopApp = vi.fn()

    render(
      <CompleteView
        desktopApp={{
          displayName: 'Codex 桌面版',
          installed: false,
          statusMessage: '未检测到 Codex 桌面版'
        }}
        onInstallDesktopApp={onInstallDesktopApp}
        onOpenDesktopApp={() => {}}
        summary={{
          codexVersion: '0.1.0',
          configPath: 'C:\\Users\\Administrator\\.codex\\config.toml',
          keyMask: 'sk-***1234',
          status: 'ready'
        }}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: '前往安装 Codex 桌面版' }))
    expect(onInstallDesktopApp).toHaveBeenCalledTimes(1)
  })

  it('warns api-key users to switch out of Work mode in the desktop app', () => {
    render(
      <CompleteView
        desktopApp={{
          displayName: 'Codex 桌面版',
          installed: true,
          statusMessage: '已检测到 Codex 桌面版'
        }}
        onInstallDesktopApp={() => {}}
        onOpenDesktopApp={() => {}}
        summary={{
          codexVersion: '0.1.0',
          configPath: 'C:\\Users\\Administrator\\.codex\\config.toml',
          keyMask: 'sk-***1234',
          status: 'ready'
        }}
      />
    )

    const note = screen.getByRole('note')
    expect(note).toHaveTextContent('Work 模式')
    expect(note).toHaveTextContent('Work browser access requires an authenticated account')
  })

  it('no longer advertises LiveToken and offers 切换网关 instead', () => {
    const onOpenGatewaySwitch = vi.fn()

    render(
      <CompleteView
        desktopApp={{
          displayName: 'Codex 桌面版',
          installed: true,
          statusMessage: '已检测到 Codex 桌面版'
        }}
        onInstallDesktopApp={() => {}}
        onOpenDesktopApp={() => {}}
        onOpenGatewaySwitch={onOpenGatewaySwitch}
        summary={{
          codexVersion: '0.1.0',
          configPath: 'C:\Users\Administrator\.codex\config.toml',
          keyMask: 'sk-***1234',
          status: 'ready'
        }}
      />
    )

    expect(screen.queryByText(/livetoken/i)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /切换网关/ }))
    expect(onOpenGatewaySwitch).toHaveBeenCalledTimes(1)
  })
})
