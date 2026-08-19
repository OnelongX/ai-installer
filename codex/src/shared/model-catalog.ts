// Codex reads a `model_catalog_json` file to decide which models its `/model`
// picker offers. The gateway's /v1/models only advertises SOME models (e.g. the
// external SolaEon endpoint lists Claude only; the internal one lists GPT +
// Claude), so — exactly like the reference sync-models.py — we merge whatever
// the gateway reports with a curated EXTRA_MODELS list of ids that are known to
// route through the passthrough gateway but aren't always enumerated.
//
// This module is the TypeScript port of sync-models.py: same catalog entry
// shape, same priority / context-window / display-name heuristics, so the file
// the installer writes is byte-compatible with what Codex already accepts.

/** Ids that route through the gateway but /v1/models may not advertise. */
export const EXTRA_MODELS: string[] = [
  'gpt-5.6-sol',
  'gpt-5.6-terra',
  'gpt-5.6-luna',
  'gpt-5.6',
  'gpt-5.5',
  'gpt-5.4',
  'gpt-5.4-mini',
  'gpt-5.3-codex',
  'gpt-5.3-codex-spark',
  'gpt-5.2',
  'deepseek-v4-flash',
  'deepseek-v4-pro',
  'kimi-k3'
]

export interface CatalogReasoningLevel {
  effort: string
  description: string
}

export interface CatalogModel {
  slug: string
  display_name: string
  description: string
  context_window: number
  max_context_window: number
  supported_reasoning_levels: CatalogReasoningLevel[]
  shell_type: string
  visibility: string
  supported_in_api: boolean
  priority: number
  availability_nux: null
  upgrade: null
  base_instructions: string
  supports_reasoning_summaries: boolean
  support_verbosity: boolean
  default_verbosity: null
  apply_patch_tool_type: null
  truncation_policy: { mode: string; limit: number }
  supports_parallel_tool_calls: boolean
  experimental_supported_tools: string[]
}

export interface ModelCatalog {
  models: CatalogModel[]
}

// Lower = shown first, matching sync-models.py's PRIORITY_MAP.
const PRIORITY_MAP: Array<[string, number]> = [
  ['gpt-5.6', 1],
  ['gpt-5', 2],
  ['gpt-4', 3],
  ['claude', 4],
  ['deepseek-v4', 10],
  ['deepseek-v3', 11],
  ['deepseek', 12],
  ['kimi', 13]
]

const CONTEXT_WINDOW_MAP: Record<string, number> = {
  'gpt-5.6-sol': 272000,
  'gpt-5.6-terra': 272000,
  'gpt-5.6-luna': 272000,
  'gpt-5.6': 272000,
  'gpt-5.5': 272000,
  'gpt-5.4': 272000,
  'gpt-4o': 128000,
  'gpt-4o-mini': 128000,
  'deepseek-v4-pro': 128000,
  'deepseek-v4-flash': 128000,
  'deepseek-chat': 64000,
  'kimi-k3': 256000,
  'claude-opus-4': 200000,
  'claude-sonnet-4': 200000
}

const DISPLAY_NAME_MAP: Record<string, string> = {
  'gpt-5.6-sol': 'GPT-5.6 Sol',
  'gpt-5.6-terra': 'GPT-5.6 Terra',
  'gpt-5.6-luna': 'GPT-5.6 Luna',
  'gpt-5.6': 'GPT-5.6',
  'gpt-5.5': 'GPT-5.5',
  'gpt-5.4': 'GPT-5.4',
  'gpt-5.4-mini': 'GPT-5.4 Mini',
  'gpt-5.3-codex': 'GPT-5.3-Codex',
  'gpt-5.3-codex-spark': 'GPT-5.3-Codex-Spark',
  'gpt-5.2': 'GPT-5.2',
  'gpt-4o': 'GPT-4o',
  'gpt-4o-mini': 'GPT-4o Mini',
  'deepseek-v4-pro': 'DeepSeek V4 Pro',
  'deepseek-v4-flash': 'DeepSeek V4 Flash',
  'deepseek-chat': 'DeepSeek Chat',
  'kimi-k3': 'Kimi K3'
}

export function getPriority(modelId: string): number {
  for (const [prefix, priority] of PRIORITY_MAP) {
    if (modelId.startsWith(prefix)) {
      return priority
    }
  }
  return 99
}

export function getContextWindow(modelId: string, fallback = 128000): number {
  if (CONTEXT_WINDOW_MAP[modelId]) {
    return CONTEXT_WINDOW_MAP[modelId]
  }
  // Prefix match (e.g. claude-opus-4-8 -> claude-opus-4).
  for (const [id, size] of Object.entries(CONTEXT_WINDOW_MAP)) {
    if (modelId.startsWith(id)) {
      return size
    }
  }
  return fallback
}

export function getDisplayName(modelId: string): string {
  if (DISPLAY_NAME_MAP[modelId]) {
    return DISPLAY_NAME_MAP[modelId]
  }
  if (modelId.startsWith('claude-')) {
    const rest = modelId.replace('claude-', '')
    const parts = rest.split('-')
    const head = `Claude ${parts[0].charAt(0).toUpperCase()}${parts[0].slice(1)}`
    return parts.length > 1 ? `${head} ${parts.slice(1).join('-')}` : head
  }
  // gpt-4o-2024-11-20 -> GPT-4O (2024-11-20)
  const parts = modelId.split('-')
  if (parts.length >= 2) {
    const base = parts.slice(0, 2).join('-').toUpperCase()
    const suffix = parts.slice(2).join('-')
    return suffix ? `${base} (${suffix})` : base
  }
  return modelId.toUpperCase()
}

function getReasoningLevels(modelId: string): CatalogReasoningLevel[] {
  const heavy = ['gpt-5', 'opus', 'deepseek-v4-pro', 'kimi']
  if (heavy.some((token) => modelId.includes(token))) {
    return [
      { effort: 'low', description: '更快、推理更轻' },
      { effort: 'medium', description: '速度与推理深度均衡' },
      { effort: 'high', description: '更深的推理，适合复杂问题' }
    ]
  }
  if (modelId.includes('flash') || modelId.includes('mini')) {
    return [
      { effort: 'low', description: '更快、推理更轻' },
      { effort: 'medium', description: '速度与推理深度均衡' }
    ]
  }
  return [
    { effort: 'low', description: '更快' },
    { effort: 'medium', description: '均衡' },
    { effort: 'high', description: '深度推理' }
  ]
}

/** Non-chat models the gateway may list that Codex can't drive. */
function isChatModel(modelId: string): boolean {
  return !['embedding', 'whisper', 'tts', 'dall-e', 'image'].some((token) =>
    modelId.includes(token)
  )
}

export function buildCatalogEntry(modelId: string): CatalogModel {
  const contextWindow = getContextWindow(modelId)
  const displayName = getDisplayName(modelId)
  const light = modelId.includes('flash') || modelId.includes('mini')
  return {
    slug: modelId,
    display_name: displayName,
    description: `${displayName}（SolaEon 网关）`,
    context_window: contextWindow,
    max_context_window: contextWindow,
    supported_reasoning_levels: getReasoningLevels(modelId),
    shell_type: 'shell_command',
    visibility: 'list',
    supported_in_api: true,
    priority: getPriority(modelId),
    availability_nux: null,
    upgrade: null,
    base_instructions: 'You are Codex, a coding agent.',
    supports_reasoning_summaries: !light,
    support_verbosity: false,
    default_verbosity: null,
    apply_patch_tool_type: null,
    truncation_policy: { mode: 'tokens', limit: 10000 },
    supports_parallel_tool_calls: true,
    experimental_supported_tools: []
  }
}

/**
 * Build the Codex model catalog from the gateway's model ids merged with the
 * curated EXTRA_MODELS. Deduplicates, drops non-chat models, sorts by priority.
 * Works fully offline when `gatewayIds` is empty (EXTRA_MODELS only).
 */
export function buildModelCatalog(gatewayIds: string[]): ModelCatalog {
  const seen = new Set<string>()
  const ids: string[] = []
  for (const id of [...gatewayIds, ...EXTRA_MODELS]) {
    if (id && isChatModel(id) && !seen.has(id)) {
      seen.add(id)
      ids.push(id)
    }
  }
  const models = ids.map(buildCatalogEntry).sort((a, b) => a.priority - b.priority)
  return { models }
}
