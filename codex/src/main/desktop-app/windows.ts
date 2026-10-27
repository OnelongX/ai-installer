// Windows-only module: always build Windows paths, so behaviour (and the unit
// tests, which CI runs on Linux) is the same on every OS.
import { win32 as path } from 'node:path'

import type { DesktopAppStateData } from '../../shared/ipc'

export const codexDesktopDownloadUrl = 'https://openai.com/codex/get-started/'

interface ExecResult {
  exitCode: number
  stderr: string
  stdout: string
}

interface DetectWindowsDesktopAppDeps {
  exec?(command: string, args?: string[]): Promise<ExecResult>
  fileExists(path: string): Promise<boolean>
  localAppData?: string
  programFiles?: string
  programFilesX86?: string
  roamingAppData?: string
}

/** Package name of the Microsoft Store / MSIX build of the Codex desktop app. */
export const codexAppxPackageName = 'OpenAI.Codex'

const APPS_FOLDER_PREFIX = 'shell:AppsFolder\\'

// Prints "<PackageFamilyName>!<AppId>" (the AUMID) when the MSIX build is
// installed, nothing otherwise.
const appxQuery = [
  `$p = Get-AppxPackage -Name '${codexAppxPackageName}' | Select-Object -First 1`,
  "if ($p) { $id = @((Get-AppxPackageManifest $p).Package.Applications.Application)[0].Id; Write-Output ($p.PackageFamilyName + '!' + $id) }"
].join('; ')

function createInstalledState(launchPath: string): DesktopAppStateData {
  return {
    displayName: 'Codex 桌面版',
    downloadUrl: codexDesktopDownloadUrl,
    installed: true,
    launchPath,
    statusMessage: launchPath.startsWith(APPS_FOLDER_PREFIX)
      ? '已检测到 Codex 桌面版（Microsoft Store / MSIX 安装）'
      : `已检测到 ${launchPath}`
  }
}

/**
 * MSIX installs live under C:\Program Files\WindowsApps and can't be started
 * from their exe path; Windows starts them by AUMID via shell:AppsFolder.
 * Returns the command to run for such a launch path, or null for a plain
 * exe / shortcut (open those with shell.openPath).
 */
export function getDesktopAppLaunchCommand(launchPath: string) {
  return launchPath.startsWith(APPS_FOLDER_PREFIX)
    ? { command: 'explorer.exe', args: [launchPath] }
    : null
}

function createMissingState(): DesktopAppStateData {
  return {
    displayName: 'Codex 桌面版',
    downloadUrl: codexDesktopDownloadUrl,
    installed: false,
    statusMessage: '未检测到 Codex 桌面版，可继续前往官方页面安装。'
  }
}

export function getWindowsDesktopAppCandidates(deps: DetectWindowsDesktopAppDeps) {
  const candidates = [
    deps.localAppData
      ? path.join(deps.localAppData, 'Programs', 'Codex', 'Codex.exe')
      : null,
    deps.localAppData
      ? path.join(deps.localAppData, 'Programs', 'OpenAI Codex', 'Codex.exe')
      : null,
    deps.programFiles ? path.join(deps.programFiles, 'Codex', 'Codex.exe') : null,
    deps.programFilesX86 ? path.join(deps.programFilesX86, 'Codex', 'Codex.exe') : null
  ]

  return candidates.filter((candidate): candidate is string => Boolean(candidate))
}

function getStartMenuShortcutCandidates(deps: DetectWindowsDesktopAppDeps) {
  const candidates = [
    deps.roamingAppData
      ? path.join(
          deps.roamingAppData,
          'Microsoft',
          'Windows',
          'Start Menu',
          'Programs',
          'Codex.lnk'
        )
      : null,
    deps.roamingAppData
      ? path.join(
          deps.roamingAppData,
          'Microsoft',
          'Windows',
          'Start Menu',
          'Programs',
          'OpenAI Codex.lnk'
        )
      : null
  ]

  return candidates.filter((candidate): candidate is string => Boolean(candidate))
}

function parseInstallLocation(stdout: string) {
  const lines = stdout.split(/\r?\n/)

  for (const line of lines) {
    if (!line.toLowerCase().includes('installlocation')) {
      continue
    }

    const trimmed = line.trim()
    const parts = trimmed.split(/\s{2,}/)
    const value = parts.at(-1)?.trim()

    if (value) {
      return value
    }
  }

  return null
}

async function detectFromRegistry(deps: DetectWindowsDesktopAppDeps) {
  if (!deps.exec) {
    return null
  }

  const uninstallKeys = [
    'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Codex',
    'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\OpenAI Codex',
    'HKLM\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Codex',
    'HKLM\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\OpenAI Codex'
  ]

  for (const key of uninstallKeys) {
    try {
      const result = await deps.exec('reg', ['query', key, '/v', 'InstallLocation'])

      if (result.exitCode !== 0) {
        continue
      }

      const installLocation = parseInstallLocation(result.stdout)

      if (!installLocation) {
        continue
      }

      const executablePath = path.join(installLocation, 'Codex.exe')

      if (await deps.fileExists(executablePath)) {
        return executablePath
      }
    } catch {
      continue
    }
  }

  return null
}

async function detectFromAppx(deps: DetectWindowsDesktopAppDeps) {
  if (!deps.exec) {
    return null
  }

  try {
    const result = await deps.exec('powershell', ['-NoProfile', '-NonInteractive', '-Command', appxQuery])
    const aumid = result.stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => /^[^\s!]+![^\s!]+$/.test(line))

    return result.exitCode === 0 && aumid ? `${APPS_FOLDER_PREFIX}${aumid}` : null
  } catch {
    return null
  }
}

export async function detectWindowsDesktopApp(
  deps: DetectWindowsDesktopAppDeps
): Promise<DesktopAppStateData> {
  const candidates = getWindowsDesktopAppCandidates(deps)

  for (const candidate of candidates) {
    if (await deps.fileExists(candidate)) {
      return createInstalledState(candidate)
    }
  }

  for (const shortcut of getStartMenuShortcutCandidates(deps)) {
    if (await deps.fileExists(shortcut)) {
      return createInstalledState(shortcut)
    }
  }

  // The Store build (what OpenAI ships for Windows today) matches none of the
  // file / shortcut / uninstall-key probes.
  const appxLaunchPath = await detectFromAppx(deps)

  if (appxLaunchPath) {
    return createInstalledState(appxLaunchPath)
  }

  const registryExecutablePath = await detectFromRegistry(deps)

  if (registryExecutablePath) {
    return createInstalledState(registryExecutablePath)
  }

  return createMissingState()
}
