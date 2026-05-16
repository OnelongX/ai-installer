import type { PlatformAdapter } from './types'

export const linuxAdapter: PlatformAdapter = {
  id: 'linux',
  displayName: 'Linux',
  packageManagers: ['apt', 'dnf', 'pacman', 'npm'],
  supportsAutomaticNodeInstall: false,
  shell: 'bash'
}
