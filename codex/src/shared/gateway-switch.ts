// "切换网关" — switch Codex and Gemini CLI between saved gateway profiles
// without reinstalling (the core of CC Switch, scoped to our gateways).
//
// A profile is one gateway + key + default models. Switching rewrites only the
// installer-owned bits of each tool's config (backed up first) and the env
// vars the tools read; everything else in those files is left alone.

import type { NetworkMode, ProviderId } from './provider-config'

export type SwitchTarget = 'codex' | 'gemini'

export const switchTargets: SwitchTarget[] = ['codex', 'gemini']

export const switchTargetLabels: Record<SwitchTarget, string> = {
  codex: 'Codex',
  gemini: 'Gemini CLI'
}

export const DEFAULT_GEMINI_MODEL = 'gemini-3-pro'

export interface GatewayProfile {
  id: string
  name: string
  provider: ProviderId
  networkMode: NetworkMode
  codexModel: string
  geminiModel: string
  /** masked key for display; the key itself never leaves the main process */
  keyMask: string
  updatedAt: string
}

export interface GatewayProfilesState {
  profiles: GatewayProfile[]
  activeProfileId?: string
  /** whether the `gemini` command was found on this machine */
  geminiInstalled: boolean
  /** set when the saved profiles could not be read */
  error?: string
}

export type SaveGatewayProfileResult =
  | { ok: true; profile: GatewayProfile }
  | { ok: false; message: string }

export type DeleteGatewayProfileResult = { ok: true } | { ok: false; message: string }

export interface SaveGatewayProfileRequest {
  /** omit to create a new profile */
  id?: string
  name: string
  provider: ProviderId
  networkMode: NetworkMode
  codexModel: string
  geminiModel: string
  /** required for a new profile; omit when editing to keep the saved key */
  apiKey?: string
}

export interface SwitchGatewayRequest {
  profileId: string
  targets: SwitchTarget[]
}

export interface SwitchTargetResult {
  target: SwitchTarget
  ok: boolean
  message: string
}

export interface SwitchGatewayResult {
  ok: boolean
  /** the base_url the switch resolved to (after the LAN probe for solaeon/auto) */
  baseUrl?: string
  results: SwitchTargetResult[]
  /** set when the switch could not start at all (e.g. unknown profile) */
  message?: string
}

/**
 * Gemini CLI's GOOGLE_GEMINI_BASE_URL is the gateway root: the SDK appends
 * /v1beta itself, so strip an OpenAI-style /v1 suffix.
 */
export function geminiBaseUrl(baseUrl: string) {
  return baseUrl.replace(/\/+$/, '').replace(/\/v1$/i, '')
}
