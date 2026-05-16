export type ApiKeySelectionMode = 'existing' | 'new' | null

export interface ApiKeyViewState {
  existingKeyMask?: string
  mode: ApiKeySelectionMode
  value: string
}

export function isApiKeyValueValid(value: string) {
  const trimmed = value.trim()

  return trimmed.startsWith('sk-') || /^\S{64}$/.test(trimmed)
}

export function canContinueFromApiKeyState(state: ApiKeyViewState) {
  if (state.mode === 'existing') {
    return Boolean(state.existingKeyMask)
  }

  if (state.mode === 'new') {
    return isApiKeyValueValid(state.value)
  }

  return false
}

export function toInstallerApiKeyMode(state: ApiKeyViewState) {
  if (state.mode === 'existing') {
    return 'existing' as const
  }

  return 'user-env' as const
}
