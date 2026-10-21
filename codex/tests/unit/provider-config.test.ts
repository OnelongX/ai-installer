import { describe, expect, it } from 'vitest'

import {
  DEFAULT_PROVIDER,
  resolveProvider,
  solaeonEndpoints,
  isProviderId,
  isNetworkMode
} from '../../src/shared/provider-config'

describe('provider-config', () => {
  it('defaults to SolaEon over the WAN when nothing is probed', () => {
    const p = resolveProvider()
    expect(p.id).toBe('solaeon')
    expect(p.baseUrl).toBe(solaeonEndpoints.external)
    expect(DEFAULT_PROVIDER).toBe('solaeon')
  })

  it('resolves solaeon internal when forced internal', () => {
    const p = resolveProvider('solaeon', 'internal')
    expect(p.baseUrl).toBe(solaeonEndpoints.internal)
    expect(p.baseUrl).toBe('http://192.168.1.101:48760')
    expect(p.network).toBe('internal')
    expect(p.name).toBe('Solaeon')
  })

  it('resolves solaeon external when forced external', () => {
    const p = resolveProvider('solaeon', 'external')
    expect(p.baseUrl).toBe('https://ai-api.solaeon.com')
    expect(p.network).toBe('external')
  })

  it('auto mode uses internal when the LAN probe succeeds', () => {
    const p = resolveProvider('solaeon', 'auto', true)
    expect(p.network).toBe('internal')
    expect(p.baseUrl).toBe(solaeonEndpoints.internal)
  })

  it('auto mode falls back to external when the LAN probe fails', () => {
    const p = resolveProvider('solaeon', 'auto', false)
    expect(p.network).toBe('external')
    expect(p.baseUrl).toBe(solaeonEndpoints.external)
  })

  it('base_url carries no /v1 suffix for solaeon', () => {
    expect(resolveProvider('solaeon', 'internal').baseUrl).not.toMatch(/\/v1$/)
    expect(resolveProvider('solaeon', 'external').baseUrl).not.toMatch(/\/v1$/)
  })

  it('type guards accept valid values and reject junk', () => {
    // LiveToken went offline and is no longer a provider
    expect(isProviderId('livetoken')).toBe(false)
    expect(isProviderId('solaeon')).toBe(true)
    expect(isProviderId('nope')).toBe(false)
    expect(isNetworkMode('auto')).toBe(true)
    expect(isNetworkMode('internal')).toBe(true)
    expect(isNetworkMode('external')).toBe(true)
    expect(isNetworkMode('lan')).toBe(false)
  })
})
