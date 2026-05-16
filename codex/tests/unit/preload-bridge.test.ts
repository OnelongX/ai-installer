import { beforeAll, describe, expect, it, vi } from 'vitest'

import { ipcChannels, type RendererInstallerApi } from '../../src/shared/ipc'

vi.mock('electron', () => ({
  contextBridge: {
    exposeInMainWorld: () => {
      throw new Error('contextBridge unavailable in this context')
    }
  },
  ipcRenderer: {
    invoke: vi.fn(async () => undefined),
    on: vi.fn(),
    removeListener: vi.fn()
  }
}))

describe('preload bridge contract', () => {
  let api: RendererInstallerApi

  beforeAll(async () => {
    await import('../../src/preload/index')
    api = (
      globalThis as typeof globalThis & { codexInstaller?: RendererInstallerApi }
    ).codexInstaller as RendererInstallerApi
  })

  it('attaches the installer API to globalThis', () => {
    expect(api).toBeDefined()
  })

  it('exposes every IPC channel as a method on the bridge', () => {
    const exposedMethods = Object.keys(api).sort()
    const expectedMethods = Object.keys(ipcChannels).sort()

    expect(exposedMethods).toEqual(expectedMethods)
  })

  it('routes calls through ipcRenderer.invoke for invoke-style channels', async () => {
    const { ipcRenderer } = await import('electron')
    const invokeMock = ipcRenderer.invoke as ReturnType<typeof vi.fn>
    invokeMock.mockClear()

    await api.getAppInfo()

    expect(invokeMock).toHaveBeenCalledWith(ipcChannels.getAppInfo)
  })
})
