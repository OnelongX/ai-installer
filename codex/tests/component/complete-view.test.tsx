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

  it('introduces LiveToken and exposes a console CTA', () => {
    const onOpenProviderSite = vi.fn()

    render(
      <CompleteView
        desktopApp={{
          displayName: 'Codex 桌面版',
          installed: true,
          statusMessage: '已检测到 Codex 桌面版'
        }}
        onInstallDesktopApp={() => {}}
        onOpenDesktopApp={() => {}}
        onOpenProviderSite={onOpenProviderSite}
        summary={{
          codexVersion: '0.1.0',
          configPath: 'C:\\Users\\Administrator\\.codex\\config.toml',
          keyMask: 'sk-***1234',
          status: 'ready'
        }}
      />
    )

    expect(screen.getByText('关于 LiveToken')).toBeInTheDocument()
    expect(screen.getByText(/兼容 OpenAI 接口/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '打开 LiveToken 控制台' }))
    expect(onOpenProviderSite).toHaveBeenCalledTimes(1)
  })
})
