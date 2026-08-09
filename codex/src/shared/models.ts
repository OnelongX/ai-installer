// Models selectable in the Codex installer. All of them are served through the
// SolaEon / LiveToken gateway (透传), so switching model only changes the
// `model` / `review_model` fields in config.toml — the provider block, base_url
// and key stay the same.
//
// DeepSeek's own Codex integration doc uses wire_api = "responses" (which our
// provider block already uses), so DeepSeek/Kimi ride the same responses path
// as gpt-5.5.

export interface CodexModel {
  id: string
  label: string
  detail: string
}

// GPT-5.6 is a three-tier family (2026-07): Sol > Terra > Luna. The bare
// `gpt-5.6` alias routes to Sol. We list all three explicit IDs so users pick
// the exact tier. Sol is OpenAI's "best coding model yet".
export const codexModels: CodexModel[] = [
  { id: 'gpt-5.6-sol', label: 'GPT-5.6 Sol', detail: 'OpenAI · 旗舰，最强编码' },
  { id: 'gpt-5.6-terra', label: 'GPT-5.6 Terra', detail: '≈5.5，便宜一半' },
  { id: 'gpt-5.6-luna', label: 'GPT-5.6 Luna', detail: '最省，轻量' },
  { id: 'gpt-5.5', label: 'GPT-5.5', detail: 'OpenAI · 默认' },
  { id: 'gpt-5.4', label: 'GPT-5.4', detail: 'OpenAI · 上一代' },
  { id: 'gpt-5.4-mini', label: 'GPT-5.4 Mini', detail: '小、快、便宜' },
  { id: 'deepseek-v4-flash', label: 'DeepSeek V4 Flash', detail: '快、省，日常编码' },
  { id: 'deepseek-v4-pro', label: 'DeepSeek V4 Pro', detail: '更强，复杂任务' },
  { id: 'kimi-k3', label: 'Kimi K3', detail: 'Moonshot · 长上下文' }
]

// Keep gpt-5.5 as the default (the current, known-good config) — the 5.6 tiers
// and the others are opt-in from the selector. Change here to move the default.
export const DEFAULT_MODEL = 'gpt-5.5'

export function isKnownModel(value: string): boolean {
  return codexModels.some((m) => m.id === value)
}

/**
 * Turn a list of gateway model IDs into CodexModel cards: known IDs keep their
 * curated label/detail, unknown IDs fall back to the raw id. Used when the
 * installer populates the picker live from /v1/models.
 */
export function modelsFromIds(ids: string[]): CodexModel[] {
  return ids.map((id) => {
    const known = codexModels.find((m) => m.id === id)
    return known ?? { id, label: id, detail: '网关模型' }
  })
}
