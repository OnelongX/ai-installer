import type { SupportedPlatform } from './types'

export function normalizePlatform(platform: NodeJS.Platform): SupportedPlatform {
  if (platform === 'win32') {
    return 'windows'
  }

  if (platform === 'darwin') {
    return 'macos'
  }

  return 'linux'
}
