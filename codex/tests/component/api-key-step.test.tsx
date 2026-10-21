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

  it('opens 切换网关 from the first screen', () => {
    const onOpenGatewaySwitch = vi.fn()
    render(<ApiKeyStep onOpenGatewaySwitch={onOpenGatewaySwitch} />)

    fireEvent.click(screen.getByRole('button', { name: /切换网关/ }))
    expect(onOpenGatewaySwitch).toHaveBeenCalledTimes(1)
  })
})
