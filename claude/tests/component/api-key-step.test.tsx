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

  it('exposes a LiveToken registration CTA that fires the provider callback', () => {
    const onOpenProviderSite = vi.fn()
    render(
      <ApiKeyStep
        existingKeyMask="sk-***1234"
        canReuseExistingKey
        onOpenProviderSite={onOpenProviderSite}
      />
    )

    const cta = screen.getByRole('button', { name: '前往 livetoken.top' })
    expect(cta).toBeInTheDocument()

    fireEvent.click(cta)
    expect(onOpenProviderSite).toHaveBeenCalledTimes(1)
  })
})
