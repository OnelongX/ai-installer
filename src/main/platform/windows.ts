import type { PlatformAdapter } from './types'

export const windowsAdapter: PlatformAdapter = {
  id: 'windows',
  displayName: 'Windows',
  packageManagers: ['winget', 'npm'],
  supportsAutomaticNodeInstall: true,
  shell: 'powershell'
}
