import type { PlatformAdapter } from './types'

export const macosAdapter: PlatformAdapter = {
  id: 'macos',
  displayName: 'macOS',
  packageManagers: ['brew', 'npm'],
  supportsAutomaticNodeInstall: false,
  shell: 'zsh'
}
