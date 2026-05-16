import path from 'node:path'

// The preload bundle is emitted by electron-vite next to the main bundle, so
// `out/main/index.js` and `out/preload/index.mjs` are siblings both in dev
// and inside the packaged asar. Resolving relative to __dirname keeps the
// two in lockstep — there is no separate hand-written preload to drift.
export function getPreloadScriptPath(dirname: string) {
  return path.join(dirname, '..', 'preload', 'index.mjs')
}
