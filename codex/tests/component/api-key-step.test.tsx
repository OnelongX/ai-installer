import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiKeyStep } from '../../src/renderer/features/api-key/ApiKeyStep'

describe('api key step', () => {
  afterEach(() => {
    cleanup()
  })

  it('requires the user to confirm or enter a key before continuing', () => {
    render(<ApiKeyStep existingKeyMask="sk-***1234" canReuseExistingKey />)

    expect(screen.getByText('安装访问凭证')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '继续' })).toBeDisabled()
  })

  it('offers only the SolaEon gateway, defaulting to auto', () => {
    render(<ApiKeyStep existingKeyMask="sk-***1234" canReuseExistingKey />)

    for (const title of ['Solaeon · 自动', 'Solaeon · 内网', 'Solaeon · 外网']) {
      expect(screen.getByRole('button', { name: new RegExp(title) })).toBeInTheDocument()
    }
    expect(screen.queryByText(/livetoken/i)).not.toBeInTheDocument()
    expect(screen.getByText(/安装时会自动探测内网是否可达/)).toBeInTheDocument()
  })

  it('can refresh the model catalog with the already-detected key', async () => {
    const onSyncModels = vi.fn(async () => ({ ok: true, count: 61, gatewayCount: 54, path: 'x' }))
    render(<ApiKeyStep existingKeyMask="sk-***1234" canReuseExistingKey onSyncModels={onSyncModels} />)

    const button = screen.getByRole('button', { name: '⬇ 更新 Codex 模型目录' })
    expect(button).toBeEnabled()
    fireEvent.click(button)

    expect(onSyncModels).toHaveBeenCalledWith({ apiKey: undefined, provider: 'solaeon', networkMode: 'auto' })
    expect(await screen.findByText(/已更新 Codex 模型目录：共 61 个模型/)).toBeInTheDocument()
  })

  it('pulls models and refreshes the catalog with no key at all', async () => {
    const onSyncModels = vi.fn(async () => ({ ok: true, count: 61, gatewayCount: 54, path: 'x' }))
    const onListModels = vi.fn(async () => [{ id: 'gpt-6.1-sol', label: 'GPT-6.1 Sol' }])
    // no detected key, nothing typed
    render(<ApiKeyStep onSyncModels={onSyncModels} onListModels={onListModels} />)

    const pull = screen.getByRole('button', { name: '⟳ 从网关拉取' })
    const sync = screen.getByRole('button', { name: '⬇ 更新 Codex 模型目录' })
    expect(pull).toBeEnabled()
    expect(sync).toBeEnabled()

    fireEvent.click(pull)
    fireEvent.click(sync)

    expect(onListModels).toHaveBeenCalledWith({ apiKey: undefined, provider: 'solaeon', networkMode: 'auto' })
    expect(onSyncModels).toHaveBeenCalledWith({ apiKey: undefined, provider: 'solaeon', networkMode: 'auto' })
    expect(await screen.findByText(/已更新 Codex 模型目录：共 61 个模型/)).toBeInTheDocument()
  })

  it('opens 切换网关 from the first screen', () => {
    const onOpenGatewaySwitch = vi.fn()
    render(<ApiKeyStep onOpenGatewaySwitch={onOpenGatewaySwitch} />)

    fireEvent.click(screen.getByRole('button', { name: /切换网关/ }))
    expect(onOpenGatewaySwitch).toHaveBeenCalledTimes(1)
  })
})
