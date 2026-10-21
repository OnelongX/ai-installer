import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import App from '../../src/renderer/App'
import type { GatewayProfile, GatewayProfilesState } from '../../src/shared/gateway-switch'
import { createTestInstallerClient } from './helpers/installer-client'

afterEach(() => {
  cleanup()
})

const saved: GatewayProfile = {
  id: 'p1',
  name: 'SolaEon 内网',
  provider: 'solaeon',
  networkMode: 'internal',
  codexModel: 'gpt-5.5',
  geminiModel: 'gemini-3-pro',
  keyMask: 'sk***9999',
  updatedAt: '2026-10-21T00:00:00.000Z'
}

describe('切换网关 screen', () => {
  it('opens from the first screen, adds a gateway and switches to it', async () => {
    let state: GatewayProfilesState = { geminiInstalled: false, profiles: [] }
    const saveGatewayProfile = vi.fn(async () => {
      state = { ...state, profiles: [saved] }
      return { ok: true as const, profile: saved }
    })
    const switchGateway = vi.fn(async () => {
      state = { ...state, activeProfileId: 'p1' }
      return {
        ok: true,
        baseUrl: 'http://192.168.1.101:48760',
        results: [
          { target: 'codex' as const, ok: true, message: '已切到 Solaeon' },
          { target: 'gemini' as const, ok: true, message: '已切到 Solaeon（Gemini）' }
        ]
      }
    })
    const client = createTestInstallerClient({
      listGatewayProfiles: async () => state,
      saveGatewayProfile,
      switchGateway
    })

    render(<App installerClient={client} />)
    fireEvent.click(await screen.findByRole('button', { name: /切换网关/ }))

    expect(await screen.findByText(/还没有保存的网关/)).toBeInTheDocument()
    expect(screen.getByText(/未检测到 gemini 命令/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '＋ 新建网关' }))
    fireEvent.change(screen.getByLabelText('网关名称'), { target: { value: 'SolaEon 内网' } })
    fireEvent.change(screen.getByLabelText('网关'), { target: { value: 'solaeon-internal' } })
    fireEvent.change(screen.getByLabelText('网关 API Key'), { target: { value: 'sk-test-9999' } })
    fireEvent.click(screen.getByRole('button', { name: '保存' }))

    await waitFor(() =>
      expect(saveGatewayProfile).toHaveBeenCalledWith({
        id: undefined,
        name: 'SolaEon 内网',
        provider: 'solaeon',
        networkMode: 'internal',
        codexModel: 'gpt-5.5',
        geminiModel: 'gemini-3-pro',
        apiKey: 'sk-test-9999'
      })
    )

    fireEvent.click(await screen.findByRole('button', { name: '切换到「SolaEon 内网」' }))

    await waitFor(() =>
      expect(switchGateway).toHaveBeenCalledWith({ profileId: 'p1', targets: ['codex', 'gemini'] })
    )
    expect(await screen.findByText(/Codex：已切到 Solaeon/)).toBeInTheDocument()
    expect(await screen.findByText('● 当前')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '← 返回' }))
    expect(await screen.findByText('在执行任何安装前，先确认 API Key。')).toBeInTheDocument()
  })

  it('switches only the ticked tools and shows save errors', async () => {
    const switchGateway = vi.fn(async () => ({ ok: true, results: [] }))
    const client = createTestInstallerClient({
      listGatewayProfiles: async () => ({ geminiInstalled: true, profiles: [saved] }),
      saveGatewayProfile: async () => ({ ok: false as const, message: '新建配置需要填写 API Key' }),
      switchGateway
    })

    render(<App installerClient={client} />)
    fireEvent.click(await screen.findByRole('button', { name: /切换网关/ }))
    fireEvent.click(await screen.findByLabelText('Gemini CLI'))
    fireEvent.click(screen.getByRole('button', { name: '切换到「SolaEon 内网」' }))
    await waitFor(() =>
      expect(switchGateway).toHaveBeenCalledWith({ profileId: 'p1', targets: ['codex'] })
    )

    fireEvent.click(screen.getByRole('button', { name: '＋ 新建网关' }))
    fireEvent.click(screen.getByRole('button', { name: '保存' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('新建配置需要填写 API Key')
  })
})
