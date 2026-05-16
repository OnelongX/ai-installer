export type SupportedPlatform = 'linux' | 'macos' | 'windows'

export interface PlatformAdapter {
  id: SupportedPlatform
  displayName: string
  packageManagers: string[]
  supportsAutomaticNodeInstall: boolean
  shell: string
}
