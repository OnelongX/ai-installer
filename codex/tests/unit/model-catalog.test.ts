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

  it('sorts by priority (GPT-6.x as Codex orders them, then 5.6, deepseek/kimi later)', () => {
    const catalog = buildModelCatalog(['kimi-k3', 'gpt-5.6-sol', 'deepseek-v4-flash', 'gpt-6-luna'])
    expect(catalog.models.slice(0, 7).map((m) => m.slug)).toEqual([
      'gpt-6.1-sol',
      'gpt-6-astra',
      'gpt-6.1-terra',
      'gpt-6-sol',
      'gpt-6-luna',
      'gpt-5.6-sol',
      'gpt-5.6-terra'
    ])
    expect(getPriority('gpt-5.6-sol')).toBeLessThan(getPriority('deepseek-v4-flash'))
    expect(getPriority('deepseek-v4-flash')).toBeLessThan(getPriority('kimi-k3'))
  })

  it('describes the GPT-6 / 6.1 family like Codex does', () => {
    const bySlug = Object.fromEntries(
      buildModelCatalog([]).models.map((m) => [m.slug, m])
    )
    expect(bySlug['gpt-6.1-sol']).toMatchObject({ display_name: 'GPT-6.1 Sol', context_window: 500000 })
    expect(bySlug['gpt-6.1-terra']).toMatchObject({ display_name: 'GPT-6.1 Terra', context_window: 500000 })
    expect(bySlug['gpt-6-sol']).toMatchObject({ display_name: 'GPT-6 Sol', context_window: 272000 })
    expect(bySlug['gpt-6.1-sol'].supported_reasoning_levels.map((l) => l.effort)).toEqual([
      'low',
      'medium',
      'high',
      'xhigh'
    ])
    // unknown future variants still get a readable name
    expect(getDisplayName('gpt-7-nova')).toBe('GPT-7 Nova')
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
