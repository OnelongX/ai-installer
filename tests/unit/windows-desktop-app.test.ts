import { describe, expect, it } from 'vitest'

import {
  claudeDesktopDownloadUrl,
  detectWindowsDesktopApp,
  getWindowsDesktopAppCandidates
} from '../../src/main/desktop-app/windows'

describe('windows desktop app detection', () => {
  it('returns the installed app path when a candidate exists', async () => {
    const candidates = getWindowsDesktopAppCandidates({
      fileExists: async () => false,
      localAppData: 'C:\\Users\\Administrator\\AppData\\Local'
    })

    const result = await detectWindowsDesktopApp({
      fileExists: async (targetPath) => targetPath === candidates[0],
      localAppData: 'C:\\Users\\Administrator\\AppData\\Local'
    })

    expect(result.installed).toBe(true)
    expect(result.launchPath).toBe(candidates[0])
    expect(result.statusMessage).toContain(candidates[0]!)
  })

  it('detects the app from a start menu shortcut when the exe path is not in common locations', async () => {
    const startMenuShortcut =
      'C:\\Users\\Administrator\\AppData\\Roaming\\Microsoft\\Windows\\Start Menu\\Programs\\Claude.lnk'

    const result = await detectWindowsDesktopApp({
      fileExists: async (targetPath) => targetPath === startMenuShortcut,
      roamingAppData: 'C:\\Users\\Administrator\\AppData\\Roaming'
    })

    expect(result.installed).toBe(true)
    expect(result.launchPath).toBe(startMenuShortcut)
    expect(result.statusMessage).toContain('Claude.lnk')
  })

  it('detects the app from uninstall registry output when file probes miss', async () => {
    const installLocation = 'C:\\Users\\Administrator\\AppData\\Local\\Programs\\Claude'

    const result = await detectWindowsDesktopApp({
      exec: async () => ({
        exitCode: 0,
        stderr: '',
        stdout: `InstallLocation    REG_SZ    ${installLocation}\n`
      }),
      fileExists: async (targetPath) => targetPath === `${installLocation}\\Claude.exe`
    })

    expect(result.installed).toBe(true)
    expect(result.launchPath).toBe(`${installLocation}\\Claude.exe`)
  })

  it('returns the official install guidance when the app is missing', async () => {
    const result = await detectWindowsDesktopApp({
      exec: async () => ({
        exitCode: 1,
        stderr: 'not found',
        stdout: ''
      }),
      fileExists: async () => false,
      localAppData: 'C:\\Users\\Administrator\\AppData\\Local',
      programFiles: 'C:\\Program Files',
      programFilesX86: 'C:\\Program Files (x86)',
      roamingAppData: 'C:\\Users\\Administrator\\AppData\\Roaming'
    })

    expect(result.installed).toBe(false)
    expect(result.downloadUrl).toBe(claudeDesktopDownloadUrl)
    expect(result.statusMessage).toBe('未检测到 Claude Desktop，可继续前往官方页面安装。')
  })
})
