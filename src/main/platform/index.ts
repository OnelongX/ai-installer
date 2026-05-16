import { normalizePlatform } from './detect'
import { linuxAdapter } from './linux'
import { macosAdapter } from './macos'
import type { PlatformAdapter, SupportedPlatform } from './types'
import { windowsAdapter } from './windows'

const adapters: Record<SupportedPlatform, PlatformAdapter> = {
  linux: linuxAdapter,
  macos: macosAdapter,
  windows: windowsAdapter
}

export function getPlatformAdapter(platform: NodeJS.Platform = process.platform) {
  return adapters[normalizePlatform(platform)]
}

export type { PlatformAdapter, SupportedPlatform } from './types'
