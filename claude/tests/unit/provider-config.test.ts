import { describe, expect, it } from 'vitest'

import {
  DEFAULT_MODEL,
  DEFAULT_PROVIDER,
  TIER_DEFAULTS,
  baseModelIds,
  claudeModels,
  isProviderId,
  oneMillionModelIds,
  resolveProvider
} from '../../src/shared/provider-config'

describe('claude provider-config', () => {
  it('defaults to SolaEon', () => {
    expect(DEFAULT_PROVIDER).toBe('solaeon')
    expect(resolveProvider().baseUrl).toBe('https://ai-api.solaeon.com')
    expect(resolveProvider().name).toBe('SolaEon')
  })

  it('resolves LiveToken when asked', () => {
    expect(resolveProvider('livetoken').baseUrl).toBe('https://livetoken.top')
  })

  it('base_url carries no /v1 suffix', () => {
    expect(resolveProvider('solaeon').baseUrl).not.toMatch(/\/v1$/)
    expect(resolveProvider('livetoken').baseUrl).not.toMatch(/\/v1$/)
  })

  it('every provider base_url is HTTPS (Claude rejects http gateways)', () => {
    expect(resolveProvider('solaeon').baseUrl).toMatch(/^https:\/\//)
    expect(resolveProvider('livetoken').baseUrl).toMatch(/^https:\/\//)
  })

  it('exposes exactly 7 base models in order', () => {
    expect(baseModelIds()).toEqual([
      'claude-sonnet-5',
      'claude-opus-4-8',
      'claude-haiku-4-5',
      'claude-sonnet-4-6',
      'claude-opus-4-7',
      'claude-opus-4-6',
      'claude-fable-5'
    ])
  })

  it('marks exactly three 1M models', () => {
    expect(oneMillionModelIds()).toEqual([
      'claude-sonnet-5',
      'claude-opus-4-8',
      'claude-fable-5'
    ])
  })

  it('model IDs are unique', () => {
    const ids = claudeModels.map((m) => m.name)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('default model and tier defaults are consistent', () => {
    expect(DEFAULT_MODEL).toBe('claude-opus-4-8')
    expect(TIER_DEFAULTS.opus).toBe('claude-opus-4-8')
    expect(TIER_DEFAULTS.sonnet).toBe('claude-sonnet-5')
    expect(TIER_DEFAULTS.haiku).toBe('claude-haiku-4-5')
  })

  it('type guard rejects junk', () => {
    expect(isProviderId('solaeon')).toBe(true)
    expect(isProviderId('livetoken')).toBe(true)
    expect(isProviderId('nope')).toBe(false)
  })
})
