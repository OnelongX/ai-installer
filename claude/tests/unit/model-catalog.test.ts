import { describe, expect, it } from 'vitest'

import {
  deriveLabel,
  deriveTier,
  mergeClaudeModels
} from '../../src/shared/model-catalog'
import { claudeModels } from '../../src/shared/provider-config'

describe('claude model catalog', () => {
  it('derives tier from the model id', () => {
    expect(deriveTier('claude-opus-5')).toBe('opus')
    expect(deriveTier('claude-sonnet-4-6')).toBe('sonnet')
    expect(deriveTier('claude-haiku-4-5')).toBe('haiku')
    expect(deriveTier('claude-fable-5')).toBe('fable')
  })

  it('prefers the gateway display name, else derives a label', () => {
    expect(deriveLabel('claude-opus-5', 'Claude Opus 5')).toBe('Claude Opus 5')
    expect(deriveLabel('claude-opus-4-8')).toBe('Claude Opus 4.8')
    expect(deriveLabel('claude-sonnet-4-5-20250929')).toBe('Claude Sonnet 4.5 (20250929)')
  })

  it('keeps every curated model and appends new gateway models (union)', () => {
    const merged = mergeClaudeModels([
      { id: 'claude-opus-4-8', label: 'ignored' }, // already curated
      { id: 'claude-opus-5', label: 'Claude Opus 5' } // new
    ])
    // curated list is the prefix, untouched
    expect(merged.slice(0, claudeModels.length)).toEqual(claudeModels)
    // the new gateway model is appended with derived metadata
    const appended = merged.find((m) => m.name === 'claude-opus-5')
    expect(appended).toEqual({
      name: 'claude-opus-5',
      labelOverride: 'Claude Opus 5',
      anthropicFamilyTier: 'opus'
    })
    // no duplicate for the already-curated id
    expect(merged.filter((m) => m.name === 'claude-opus-4-8')).toHaveLength(1)
  })

  it('excludes non-Claude gateway models (gpt / deepseek / kimi)', () => {
    const merged = mergeClaudeModels([
      { id: 'claude-opus-5', label: 'Claude Opus 5' },
      { id: 'deepseek-v4-flash', label: 'DeepSeek V4 Flash' },
      { id: 'kimi-k3', label: 'Kimi K3' },
      { id: 'gpt-5.6-sol', label: 'GPT-5.6 Sol' }
    ])
    const names = merged.map((m) => m.name)
    expect(names).toContain('claude-opus-5')
    expect(names).not.toContain('deepseek-v4-flash')
    expect(names).not.toContain('kimi-k3')
    expect(names).not.toContain('gpt-5.6-sol')
  })

  it('curated metadata (1M / default) survives the merge', () => {
    const merged = mergeClaudeModels([{ id: 'claude-opus-4-8', label: 'x' }])
    const opus = merged.find((m) => m.name === 'claude-opus-4-8')
    expect(opus?.supports1m).toBe(true)
    expect(opus?.isFamilyDefault).toBe(true)
  })
})
