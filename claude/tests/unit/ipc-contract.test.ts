import { describe, expect, it } from 'vitest'
import { ipcChannels } from '../../src/shared/ipc'

describe('ipc contract', () => {
  it('exposes install workflow channels', () => {
    expect(ipcChannels.getAppInfo).toBe('installer:get-app-info')
    expect(ipcChannels.startInstall).toBe('installer:start')
    expect(ipcChannels.subscribeLogs).toBe('installer:subscribe-logs')
  })
})
