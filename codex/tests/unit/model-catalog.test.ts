import { describe, expect, it } from 'vitest'

import {
  EXTRA_MODELS,
  buildModelCatalog,
  getDisplayName,
  getPriority
} from '../../src/shared/model-catalog'

describe('codex model catalog', () => {
  it('includes EXTRA_MODELS even with an empty gateway list (offline)', () => {
    const catalog = buildModelCatalog([])
    const slugs = catalog.models.map((m) => m.slug)
    for (const id of EXTRA_MODELS) {
      expect(slugs).toContain(id)
    }
    expect(slugs).toContain('deepseek-v4-flash')
    expect(slugs).toContain('kimi-k3')
  })

  it('merges the gateway list with EXTRA and de-duplicates', () => {
    const catalog = buildModelCatalog(['claude-opus-4-8', 'gpt-5.6-sol', 'gpt-5.6-sol'])
    const slugs = catalog.models.map((m) => m.slug)
    // gateway-only model shows up…
    expect(slugs).toContain('claude-opus-4-8')
    // …and a model present in BOTH gateway and EXTRA appears exactly once.
    expect(slugs.filter((s) => s === 'gpt-5.6-sol')).toHaveLength(1)
  })

  it('drops non-chat models the gateway may advertise', () => {
    const catalog = buildModelCatalog(['text-embedding-3-large', 'whisper-1', 'gpt-5.5'])
    const slugs = catalog.models.map((m) => m.slug)
    expect(slugs).not.toContain('text-embedding-3-large')
    expect(slugs).not.toContain('whisper-1')
    expect(slugs).toContain('gpt-5.5')
  })

  it('sorts by priority (gpt-5.6 first, deepseek/kimi later)', () => {
    const catalog = buildModelCatalog(['kimi-k3', 'gpt-5.6-sol', 'deepseek-v4-flash'])
    const first = catalog.models[0].slug
    expect(first.startsWith('gpt-5.6')).toBe(true)
    expect(getPriority('gpt-5.6-sol')).toBeLessThan(getPriority('deepseek-v4-flash'))
    expect(getPriority('deepseek-v4-flash')).toBeLessThan(getPriority('kimi-k3'))
  })

  it('produces Codex catalog entries with the required fields', () => {
    const entry = buildModelCatalog(['gpt-5.6-sol']).models.find((m) => m.slug === 'gpt-5.6-sol')!
    expect(entry.display_name).toBe('GPT-5.6 Sol')
    expect(entry.visibility).toBe('list')
    expect(entry.supported_in_api).toBe(true)
    expect(entry.context_window).toBeGreaterThan(0)
    expect(Array.isArray(entry.supported_reasoning_levels)).toBe(true)
  })

  it('labels unknown gateway models by a sane derived name', () => {
    expect(getDisplayName('claude-opus-4-8')).toContain('Claude Opus')
  })
})
