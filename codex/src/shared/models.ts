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

export const codexModels: CodexModel[] = [
  { id: 'gpt-5.6', label: 'GPT-5.6', detail: 'OpenAI · 最新' },
  { id: 'gpt-5.5', label: 'GPT-5.5', detail: 'OpenAI · 默认' },
  { id: 'deepseek-v4-flash', label: 'DeepSeek V4 Flash', detail: '快、省，日常编码' },
  { id: 'deepseek-v4-pro', label: 'DeepSeek V4 Pro', detail: '更强，复杂任务' },
  { id: 'kimi-k3', label: 'Kimi K3', detail: 'Moonshot · 长上下文' }
]

// Keep gpt-5.5 as the default (the current, known-good config) — gpt-5.6 and the
// others are opt-in from the selector. Change here to move the default.
export const DEFAULT_MODEL = 'gpt-5.5'

export function isKnownModel(value: string): boolean {
  return codexModels.some((m) => m.id === value)
}
