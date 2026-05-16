import path from 'node:path'

import type { DesktopAppStateData } from '../../shared/ipc'

export const claudeDesktopDownloadUrl = 'https://claude.ai/download'

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

function createInstalledState(launchPath: string): DesktopAppStateData {
  return {
    displayName: 'Claude Desktop',
    downloadUrl: claudeDesktopDownloadUrl,
    installed: true,
    launchPath,
    statusMessage: `已检测到 ${launchPath}`
  }
}

function createMissingState(): DesktopAppStateData {
  return {
    displayName: 'Claude Desktop',
    downloadUrl: claudeDesktopDownloadUrl,
    installed: false,
    statusMessage: '未检测到 Claude Desktop，可继续前往官方页面安装。'
  }
}

export function getWindowsDesktopAppCandidates(deps: DetectWindowsDesktopAppDeps) {
  const candidates = [
    // Current Anthropic installer (Squirrel-based) lands here:
    deps.localAppData
      ? path.join(deps.localAppData, 'AnthropicClaude', 'claude.exe')
      : null,
    deps.localAppData
      ? path.join(deps.localAppData, 'AnthropicClaude', 'Claude.exe')
      : null,
    deps.localAppData
      ? path.join(deps.localAppData, 'Programs', 'Claude', 'Claude.exe')
      : null,
    deps.localAppData
      ? path.join(deps.localAppData, 'Programs', 'claude-desktop', 'Claude.exe')
      : null,
    deps.programFiles ? path.join(deps.programFiles, 'Claude', 'Claude.exe') : null,
    deps.programFilesX86 ? path.join(deps.programFilesX86, 'Claude', 'Claude.exe') : null
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
          'Claude.lnk'
        )
      : null,
    deps.roamingAppData
      ? path.join(
          deps.roamingAppData,
          'Microsoft',
          'Windows',
          'Start Menu',
          'Programs',
          'Anthropic',
          'Claude.lnk'
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
    'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Claude',
    'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\AnthropicClaude',
    'HKLM\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Claude',
    'HKLM\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\AnthropicClaude'
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

      for (const exeName of ['Claude.exe', 'claude.exe']) {
        const executablePath = path.join(installLocation, exeName)

        if (await deps.fileExists(executablePath)) {
          return executablePath
        }
      }
    } catch {
      continue
    }
  }

  return null
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

  const registryExecutablePath = await detectFromRegistry(deps)

  if (registryExecutablePath) {
    return createInstalledState(registryExecutablePath)
  }

  return createMissingState()
}
