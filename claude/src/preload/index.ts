import { contextBridge, ipcRenderer } from 'electron'

import { ipcChannels, type RendererInstallerApi } from '../shared/ipc'

const api: RendererInstallerApi = {
  dismissRecoveryState: () => ipcRenderer.invoke(ipcChannels.dismissRecoveryState),
  getAppInfo: () => ipcRenderer.invoke(ipcChannels.getAppInfo),
  getDesktopAppState: () => ipcRenderer.invoke(ipcChannels.getDesktopAppState),
  getRecoveryState: () => ipcRenderer.invoke(ipcChannels.getRecoveryState),
  loadEnvironment: () => ipcRenderer.invoke(ipcChannels.loadEnvironment),
  openDesktopApp: () => ipcRenderer.invoke(ipcChannels.openDesktopApp),
  openDesktopAppInstall: () => ipcRenderer.invoke(ipcChannels.openDesktopAppInstall),
  openProviderSite: () => ipcRenderer.invoke(ipcChannels.openProviderSite),
  validateApiKey: (input) => ipcRenderer.invoke(ipcChannels.validateApiKey, input),
  generatePlan: (input) => ipcRenderer.invoke(ipcChannels.generatePlan, input),
  startInstall: (input) => ipcRenderer.invoke(ipcChannels.startInstall, input),
  subscribeLogs: (listener) => {
    const wrappedListener = (
      _event: Electron.IpcRendererEvent,
      event: Parameters<typeof listener>[0]
    ) => {
      listener(event)
    }

    ipcRenderer.on(ipcChannels.subscribeLogs, wrappedListener)

    return () => {
      ipcRenderer.removeListener(ipcChannels.subscribeLogs, wrappedListener)
    }
  },
  retryTask: (taskId) => ipcRenderer.invoke(ipcChannels.retryTask, taskId),
  resumeInstall: () => ipcRenderer.invoke(ipcChannels.resumeInstall),
  exportDiagnostics: () => ipcRenderer.invoke(ipcChannels.exportDiagnostics)
}

try {
  contextBridge.exposeInMainWorld('claudeInstaller', api)
} catch {
  ;(globalThis as typeof globalThis & { claudeInstaller?: RendererInstallerApi }).claudeInstaller = api
}

;(globalThis as typeof globalThis & { claudeInstaller?: RendererInstallerApi }).claudeInstaller = api
