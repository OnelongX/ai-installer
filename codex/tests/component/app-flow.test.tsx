import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import App from '../../src/renderer/App'

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
    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: /sk-\*\*\*1234/i }))
    fireEvent.click(screen.getByRole('button', { name: '继续', exact: true }))

    expect(await screen.findByText('环境检测')).toBeInTheDocument()
  })
})
