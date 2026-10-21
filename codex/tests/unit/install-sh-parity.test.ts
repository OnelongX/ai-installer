import { spawn } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import os from 'node:os'
import path from 'node:path'

import { afterAll, describe, expect, it } from 'vitest'

import { buildConfigToml } from '../../src/main/installer/tasks/write-config.windows'
import { buildModelCatalog } from '../../src/shared/model-catalog'
import { DEFAULT_PROVIDER, resolveProvider, solaeonEndpoints } from '../../src/shared/provider-config'

// install_codex.sh can't import the TS sources (it runs via curl | bash), so it
// carries its own copy of the config template, provider endpoints and model
// catalog builder. These tests keep that copy in lockstep with the Windows app.

// vitest runs from the codex/ package root
const script = readFileSync(path.resolve(process.cwd(), 'install_codex.sh'), 'utf8').replace(/\r\n/g, '\n')
const tmpDirs: string[] = []
const servers: Server[] = []

afterAll(() => {
  for (const dir of tmpDirs) rmSync(dir, { force: true, recursive: true })
  for (const server of servers) server.close()
})

function shellVar(name: string) {
  return new RegExp(`^${name}="([^"]*)"$`, 'm').exec(script)?.[1]
}

/** The config.toml heredoc with the shell variables filled in, comments dropped. */
function renderShellTemplate(vars: Record<string, string>) {
  const body = /cat > "\$conf\.new" <<TOML\n([\s\S]*?)\nTOML\n/.exec(script)?.[1]
  expect(body, 'config.toml heredoc in install_codex.sh').toBeTruthy()
  return body!
    .replace(/\$\{?(\w+)\}?/g, (_, name: string) => {
      expect(vars, `value for $${name}`).toHaveProperty(name)
      return vars[name]
    })
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('#'))
    .join('\n')
}

function runCatalogJs(baseUrl: string, apiKey = 'sk-test') {
  const js = /<<'CATALOG_JS'\n([\s\S]*?)\nCATALOG_JS/.exec(script)?.[1]
  expect(js, 'CATALOG_JS block in install_codex.sh').toBeTruthy()
  const dir = mkdtempSync(path.join(os.tmpdir(), 'codex-catalog-'))
  tmpDirs.push(dir)
  const out = path.join(dir, 'models-catalog.json')

  // Async spawn: the test's HTTP server must keep serving while node runs.
  return new Promise<{ catalog: unknown; stdout: string }>((resolve, reject) => {
    const child = spawn(process.execPath, ['-', baseUrl, out], {
      env: { ...process.env, CODEX_GATEWAY_KEY: apiKey }
    })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk) => (stdout += chunk))
    child.stderr.on('data', (chunk) => (stderr += chunk))
    child.on('error', reject)
    child.on('close', (code) => {
      if (code !== 0) return reject(new Error(`CATALOG_JS exited ${code}: ${stderr}`))
      resolve({ catalog: JSON.parse(readFileSync(out, 'utf8')), stdout: stdout.trim() })
    })
    child.stdin.end(js)
  })
}

function startGateway(body: unknown, seen: { auth?: string; url?: string }) {
  return new Promise<string>((resolve) => {
    const server = createServer((req, res) => {
      seen.auth = req.headers.authorization
      seen.url = req.url
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify(body))
    })
    servers.push(server)
    server.listen(0, '127.0.0.1', () =>
      resolve(`http://127.0.0.1:${(server.address() as AddressInfo).port}`)
    )
  })
}

describe('install_codex.sh parity with the Windows installer', () => {
  it('uses the same provider endpoints', () => {
    expect(shellVar('PROVIDER')).toBe(DEFAULT_PROVIDER)
    expect(shellVar('SOLAEON_INTERNAL')).toBe(solaeonEndpoints.internal)
    expect(shellVar('SOLAEON_EXTERNAL')).toBe(solaeonEndpoints.external)
    expect(shellVar('DEFAULT_MODEL')).toBe('gpt-5.5')
  })

  it.each([
    ['solaeon internal', resolveProvider('solaeon', 'internal')],
    ['solaeon external', resolveProvider('solaeon', 'external')]
  ])('renders the same config.toml as Windows (%s)', (_, provider) => {
    const catalogPath = '/home/dev/.codex/models-catalog.json'
    const shell = renderShellTemplate({
      BASE_URL: provider.baseUrl,
      DEFAULT_MODEL: 'kimi-k3',
      PROVIDER_NAME: provider.name,
      catalog: catalogPath
    })

    expect(shell).toBe(buildConfigToml({ provider, model: 'kimi-k3', catalogPath }))
  })

  it('builds the same model catalog from the gateway list', async () => {
    const seen: { auth?: string; url?: string } = {}
    const base = await startGateway(
      { models: [{ slug: 'claude-opus-4-8', display_name: 'Opus' }, { slug: 'text-embedding-3' }, { slug: 'gpt-5.5' }] },
      seen
    )

    const { catalog, stdout } = await runCatalogJs(`${base}/v1`, 'sk-parity')

    expect(seen.url).toBe('/v1/models')
    expect(seen.auth).toBe('Bearer sk-parity')
    expect(catalog).toEqual(buildModelCatalog(['claude-opus-4-8', 'text-embedding-3', 'gpt-5.5']))
    expect(stdout).toBe(`3 ${buildModelCatalog(['claude-opus-4-8', 'gpt-5.5']).models.length}`)
  })

  it('accepts the OpenAI {data:[{id}]} shape too', async () => {
    const base = await startGateway({ data: [{ id: 'deepseek-chat' }] }, {})
    const { catalog } = await runCatalogJs(base)
    expect(catalog).toEqual(buildModelCatalog(['deepseek-chat']))
  })

  it('falls back to the built-in extras when the gateway is unreachable', async () => {
    const base = await startGateway({}, {})
    servers.pop()!.close()

    const { catalog, stdout } = await runCatalogJs(base)

    expect(catalog).toEqual(buildModelCatalog([]))
    expect(stdout).toBe(`0 ${buildModelCatalog([]).models.length}`)
  })
})
