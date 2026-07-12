import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import App from '../../src/renderer/App'
import { getInstallerClient } from '../../src/renderer/install-flow/client'

describe('app flow', () => {
  afterEach(() => {
    cleanup()
  })

  it('moves from api key to detection and then to install plan', async () => {
    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: /输入新的 Key/i }))
    fireEvent.change(screen.getByLabelText('API Key'), {
      target: { value: 'sk-test-key' }
    })
    fireEvent.click(screen.getByRole('button', { name: '继续', exact: true }))

    expect(await screen.findByText('环境检测')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '继续到安装计划' }))

    expect(screen.getByText('安装计划')).toBeInTheDocument()
  })

  it('moves from install plan to completion after execution', async () => {
    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: /输入新的 Key/i }))
    fireEvent.change(screen.getByLabelText('API Key'), {
      target: { value: 'sk-test-key' }
    })
    fireEvent.click(screen.getByRole('button', { name: '继续', exact: true }))
    expect(await screen.findByText('环境检测')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '继续到安装计划' }))
    fireEvent.click(screen.getByRole('button', { name: '开始安装' }))

    expect(await screen.findByText('Codex 已可使用。')).toBeInTheDocument()
  })

  it('moves forward when reusing an existing key', async () => {
    // The reuse card only shows when the backend reports a detected key,
    // so drive App with a client that returns one.
    const client = {
      ...getInstallerClient(),
      getExistingApiKey: async () => ({ exists: true as const, mask: 'sk-***1234' })
    }
    render(<App installerClient={client} />)

    fireEvent.click(await screen.findByRole('button', { name: /sk-\*\*\*1234/i }))
    fireEvent.click(screen.getByRole('button', { name: '继续', exact: true }))

    expect(await screen.findByText('环境检测')).toBeInTheDocument()
  })

  it('hides the reuse card when no existing key is detected', async () => {
    const client = {
      ...getInstallerClient(),
      getExistingApiKey: async () => ({ exists: false as const })
    }
    render(<App installerClient={client} />)

    // wait for the api-key screen
    await screen.findByRole('button', { name: /输入新的 Key/i })
    expect(screen.queryByText('继续使用已检测到的 Key')).not.toBeInTheDocument()
  })
})
