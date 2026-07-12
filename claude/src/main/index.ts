import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { detectWindowsDesktopApp } from '../main/desktop-app/windows'
import { createInstallSessionController } from '../main/installer/session-controller'
import { ensureSettingsJson } from '../main/installer/tasks/write-config.windows'
import { getPreloadScriptPath } from '../main/preload-path'
import { createSmokeTestReport, getSmokeTestOutputPath } from '../main/smoke-test'
import { runCommand } from '../main/system/exec'
import { ipcChannels, providerSiteUrl } from '../shared/ipc'
import { appShellTitle } from '../shared/types'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const smokeTestOutputPath = getSmokeTestOutputPath(process.argv)

function getAppTitle() {
  return `${appShellTitle} ${app.getVersion()}`
}

function createWindow() {
  const window = new BrowserWindow({
    width: 1200,
    height: 800,
    show: !smokeTestOutputPath,
    title: getAppTitle(),
    webPreferences: {
      contextIsolation: false,
      nodeIntegration: true,
      preload: getPreloadScriptPath(__dirname),
      sandbox: false
    }
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    void window.loadURL(process.env.VITE_DEV_SERVER_URL)
    return window
  }

  void window.loadFile(path.join(__dirname, '../renderer/index.html'))
  return window
}

async function writeSmokeTestReport(status: 'failed' | 'ready', error?: string) {
  if (!smokeTestOutputPath) {
    return
  }

  await fs.mkdir(path.dirname(smokeTestOutputPath), { recursive: true })
  await fs.writeFile(
    smokeTestOutputPath,
    JSON.stringify(
      createSmokeTestReport({
        appVersion: app.getVersion(),
        error,
        platform: process.platform,
        status,
        windowTitle: getAppTitle()
      }),
      null,
      2
    ),
    'utf8'
  )
}

function setupSmokeTest(window: BrowserWindow) {
  if (!smokeTestOutputPath) {
    return
  }

  let finalized = false
  const finalize = async (status: 'failed' | 'ready', error?: string) => {
    if (finalized) {
      return
    }

    finalized = true
    clearTimeout(timeout)
    await writeSmokeTestReport(status, error)
    app.exit(status === 'ready' ? 0 : 1)
  }

  const timeout = setTimeout(() => {
    void finalize('failed', 'Smoke test timed out waiting for the renderer to load.')
  }, 30000)

  window.webContents.once('did-finish-load', () => {
    void window.webContents
      .executeJavaScript(
        'typeof window.claudeInstaller !== "undefined" || typeof window.require === "function"',
        true
      )
      .then((hasInstallerBridge) => {
        if (!hasInstallerBridge) {
          void finalize('failed', 'Renderer loaded without an installer bridge.')
          return
        }

        void finalize('ready')
      })
      .catch((error) => {
        void finalize('failed', error instanceof Error ? error.message : String(error))
      })
  })
  window.webContents.on('preload-error', (_event, preloadPath, error) => {
    void finalize('failed', `Preload failed (${preloadPath}): ${error.message}`)
  })
  window.webContents.once('did-fail-load', (_event, errorCode, errorDescription) => {
    void finalize('failed', `Renderer load failed (${errorCode}): ${errorDescription}`)
  })
  window.on('unresponsive', () => {
    void finalize('failed', 'Application window became unresponsive during smoke test.')
  })
}

async function getDesktopAppState() {
  if (process.platform === 'win32') {
    return detectWindowsDesktopApp({
      fileExists: async (targetPath) => {
        try {
          await fs.access(targetPath)
          return true
        } catch {
          return false
        }
      },
      localAppData: process.env.LOCALAPPDATA,
      programFiles: process.env.ProgramFiles,
      programFilesX86: process.env['ProgramFiles(x86)'],
      roamingAppData: process.env.APPDATA
    })
  }

  return {
    displayName: 'Claude Desktop',
    downloadUrl: 'https://claude.ai/download',
    installed: false,
    statusMessage: '当前平台暂未接入桌面版自动检测，可前往官方页面安装。'
  }
}

function registerInstallerIpc() {
  const userProfile = process.env.USERPROFILE ?? app.getPath('home')
  const sessionPath = path.join(app.getPath('userData'), 'installer-session.json')
  const controller = createInstallSessionController({
    appVersion: app.getVersion(),
    clearSession: async () => {
      await fs.rm(sessionPath, { force: true })
    },
    exec: (command, args, options) => runCommand(command, args, options?.timeoutMs),
    fileExists: async (targetPath) => {
      try {
        await fs.access(targetPath)
        return true
      } catch {
        return false
      }
    },
    loadSession: async () => {
      try {
        return await fs.readFile(sessionPath, 'utf8')
      } catch {
        return null
      }
    },
    mkdir: (targetPath) => fs.mkdir(targetPath, { recursive: true }),
    platform: process.platform,
    rename: (from, to) => fs.rename(from, to),
    saveSession: (serialized) => fs.writeFile(sessionPath, serialized, 'utf8'),
    userProfile,
    writeFile: (targetPath, value) => fs.writeFile(targetPath, value, 'utf8')
  })

  ipcMain.handle(ipcChannels.dismissRecoveryState, () => controller.dismissRecoveryState())
  ipcMain.handle(ipcChannels.exportDiagnostics, async () => controller.exportDiagnostics())
  ipcMain.handle(ipcChannels.generatePlan, (_event, input) => controller.generatePlan(input))
  ipcMain.handle(ipcChannels.getExistingApiKey, () => controller.getExistingApiKey())
  ipcMain.handle(ipcChannels.getAppInfo, async () => ({
    title: appShellTitle,
    version: app.getVersion()
  }))
  ipcMain.handle(ipcChannels.getDesktopAppState, async () => getDesktopAppState())
  ipcMain.handle(ipcChannels.getRecoveryState, () => controller.getRecoveryState())
  ipcMain.handle(ipcChannels.loadEnvironment, () => controller.loadEnvironment())
  ipcMain.handle(ipcChannels.openDesktopApp, async () => {
    const state = await getDesktopAppState()

    if (!state.installed || !state.launchPath) {
      return false
    }

    const result = await shell.openPath(state.launchPath)
    return result === ''
  })
  ipcMain.handle(ipcChannels.openDesktopAppInstall, async () => {
    const state = await getDesktopAppState()

    try {
      await shell.openExternal(state.downloadUrl)
      return true
    } catch {
      return false
    }
  })
  ipcMain.handle(ipcChannels.openProviderSite, async () => {
    try {
      await shell.openExternal(providerSiteUrl)
      return true
    } catch {
      return false
    }
  })
  ipcMain.handle(ipcChannels.resumeInstall, async (event) =>
    controller.resumeInstall((logEvent) => {
      event.sender.send(ipcChannels.subscribeLogs, logEvent)
    })
  )
  ipcMain.handle(ipcChannels.retryTask, async (event, taskId) =>
    controller.retryTask(taskId, (logEvent) => {
      event.sender.send(ipcChannels.subscribeLogs, logEvent)
    })
  )
  ipcMain.handle(ipcChannels.startInstall, async (event, input) =>
    controller.startInstall(input, (logEvent) => {
      event.sender.send(ipcChannels.subscribeLogs, logEvent)
    })
  )
  ipcMain.handle(ipcChannels.validateApiKey, (_event, input) => controller.validateApiKey(input))
}

async function ensureDefaultInstallerConfig() {
  const userProfile = process.env.USERPROFILE ?? app.getPath('home')

  await ensureSettingsJson({
    fileExists: async (targetPath) => {
      try {
        await fs.access(targetPath)
        return true
      } catch {
        return false
      }
    },
    mkdir: (targetPath) => fs.mkdir(targetPath, { recursive: true }),
    userProfile,
    writeFile: (targetPath, value) => fs.writeFile(targetPath, value, 'utf8')
  })
}

app.whenReady().then(() => {
  void ensureDefaultInstallerConfig()
  registerInstallerIpc()
  const window = createWindow()
  setupSmokeTest(window)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      const nextWindow = createWindow()
      setupSmokeTest(nextWindow)
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
