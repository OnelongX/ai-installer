// Client-side model refresh for the Claude installer.
//
// settings.json (`availableModels`) drives the Claude Code CLI /model picker;
// the HKCU\Software\Policies\Claude `inferenceModels` value drives the Claude
// Desktop picker. Both are seeded from the curated `claudeModels` list at
// install time. This module lets us refresh them from the gateway's live
// /v1/models without a new installer release: we merge whatever the gateway
// reports with the curated list (union — curated is never dropped) and derive
// the rich metadata (tier / label / 1M) Claude needs but /v1/models omits.

import { claudeModels, type ClaudeModel } from './provider-config'

const TIER_TOKENS: Array<[string, string]> = [
  ['opus', 'opus'],
  ['sonnet', 'sonnet'],
  ['haiku', 'haiku'],
  ['fable', 'fable']
]

/** Infer the Anthropic tier bucket from a model id. */
export function deriveTier(modelId: string): string {
  const lowered = modelId.toLowerCase()
  for (const [token, tier] of TIER_TOKENS) {
    if (lowered.includes(token)) {
      return tier
    }
  }
  return 'sonnet'
}

/** Human label: prefer the gateway's display_name, else derive from the id. */
export function deriveLabel(modelId: string, displayName?: string): string {
  if (displayName && displayName.trim()) {
    return displayName.trim()
  }
  const rest = modelId.replace(/^claude-/i, '')
  const parts = rest.split('-')
  if (parts.length === 0) {
    return modelId
  }
  const family = parts[0].charAt(0).toUpperCase() + parts[0].slice(1)
  const version = parts.slice(1)
  if (version.length === 0) {
    return `Claude ${family}`
  }
  // Wrap an 8-digit date suffix in parens; join the rest with dots (4-8 -> 4.8).
  const dateIdx = version.findIndex((p) => /^\d{8}$/.test(p))
  if (dateIdx >= 0) {
    const head = version.slice(0, dateIdx).join('.')
    const date = version[dateIdx]
    return head ? `Claude ${family} ${head} (${date})` : `Claude ${family} (${date})`
  }
  return `Claude ${family} ${version.join('.')}`
}

/** Build a ClaudeModel entry for an id the curated list doesn't cover. */
export function deriveClaudeModel(modelId: string, displayName?: string): ClaudeModel {
  return {
    name: modelId,
    labelOverride: deriveLabel(modelId, displayName),
    anthropicFamilyTier: deriveTier(modelId)
  }
}

export interface GatewayModel {
  id: string
  label: string
}

/**
 * Merge the gateway's live model list onto the curated catalog. The curated
 * entries (with their labelOverride / isFamilyDefault / supports1m metadata)
 * are always kept and win for ids present in both; ids the gateway reports that
 * we don't know about are appended with derived metadata. Order: curated first
 * (preserves the Desktop picker order), then new gateway models.
 *
 * A union, not a replace — a refresh never drops a curated model, and picks up
 * newly-added gateway models (e.g. a future claude-opus-5) automatically.
 */
export function mergeClaudeModels(gateway: GatewayModel[]): ClaudeModel[] {
  const merged: ClaudeModel[] = [...claudeModels]
  const known = new Set(merged.map((m) => m.name))
  for (const { id, label } of gateway) {
    // Claude-only: the shared gateway also serves gpt / deepseek / kimi (those
    // belong to the Codex installer). Adding a non-Claude id here would put it
    // in the Claude picker mislabeled with a guessed tier — so skip it.
    if (id && /^claude[-.]/i.test(id) && !known.has(id)) {
      known.add(id)
      merged.push(deriveClaudeModel(id, label))
    }
  }
  return merged
}
