import path from 'node:path'

import { describe, expect, it } from 'vitest'
import { getPreloadScriptPath } from '../../src/main/preload-path'

describe('preload path resolution', () => {
  it('resolves the bundled preload bridge next to the main bundle', () => {
    const preloadPath = getPreloadScriptPath(path.join(process.cwd(), 'out', 'main'))

    expect(preloadPath).toBe(
      path.join(process.cwd(), 'out', 'main', '..', 'preload', 'index.mjs')
    )
  })
})
