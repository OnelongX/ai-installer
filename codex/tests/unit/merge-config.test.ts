import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterAll, describe, expect, it } from 'vitest'

import { mergeConfigToml, parseTomlTables } from '../../src/main/installer/tasks/merge-config'
import { buildConfigToml, mergeInstallerConfig } from '../../src/main/installer/tasks/write-config.windows'

// Shaped like a real long-lived Codex config: Codex itself and plugins add
// tables the installer knows nothing about.
const userConfig = [
  'model = "gpt-6.1-sol"',
  'model_reasoning_effort = "high"',
  'service_tier = "priority"',
  '',
  'notify = [ "C:\\\\Codex\\\\codex-computer-use.exe", "turn-ended" ]',
  'trusted_tools = [',
  '  "shell",   # inline comment with ] bracket',
  '  "apply_patch",',
  ']',
  "instructions = '''",
  '[not-a-table]',
  "keep = 'me'",
  "'''",
  '',
  '[marketplaces.local-repo]',
  'source_type = "local"',
  'source = "\\\\\\\\?\\\\E:\\\\subagent"',
  '',
  '[plugins."documents@openai-primary-runtime"]',
  'enabled = true',
  '',
  '[projects."e:\\\\cc-gateway"]',
  'trust_level = "trusted"',
  '',
  '[mcp_servers.pencil]',
  'command = "c:\\\\pencil\\\\mcp-server.exe"',
  'args = [ "--app", "visual_studio_code" ]',
  '',
  '[mcp_servers.pencil.env]',
  'TOKEN_FILE = \'C:\\Users\\a\\.pencil\'',
  '',
  '[desktop]',
  'keepRemoteControlAwakeWhilePluggedIn = true',
  'conversationDetailMode = "STEPS_PROSE"',
  '',
  '[[hooks.pre_tool_use]]',
  'command = "a"',
  '',
  '[[hooks.pre_tool_use]]',
  'command = "b"',
  '',
  '[model_providers.cm]',
  'name = "Old"',
  'base_url = "https://old.example/v1"',
  ''
].join('\r\n')

const tmpDirs: string[] = []
afterAll(() => {
  for (const dir of tmpDirs) rmSync(dir, { force: true, recursive: true })
})

function runShellMerge(existing: string, rendered: string) {
  // vitest runs from the codex/ package root
  const script = readFileSync(path.resolve(process.cwd(), 'install_codex.sh'), 'utf8')
  const js = /<<'MERGE_JS'\r?\n([\s\S]*?)\r?\nMERGE_JS/.exec(script)?.[1]
  expect(js, 'MERGE_JS block in install_codex.sh').toBeTruthy()
  const dir = mkdtempSync(path.join(os.tmpdir(), 'codex-merge-'))
  tmpDirs.push(dir)
  writeFileSync(path.join(dir, 'existing.toml'), existing)
  writeFileSync(path.join(dir, 'rendered.toml'), rendered)
  return execFileSync(
    process.execPath,
    ['-', path.join(dir, 'existing.toml'), path.join(dir, 'rendered.toml')],
    { input: js, encoding: 'utf8' }
  )
}

describe('config.toml merge', () => {
  it('keeps multi-line values in one entry and ignores brackets inside strings', () => {
    const root = parseTomlTables(userConfig)[0]
    const keys = root.entries.map((entry) => entry.key).filter(Boolean)
    expect(keys).toEqual([
      'model',
      'model_reasoning_effort',
      'service_tier',
      'notify',
      'trusted_tools',
      'instructions'
    ])
    expect(root.entries.find((entry) => entry.key === 'trusted_tools')?.lines).toHaveLength(4)
    expect(root.entries.find((entry) => entry.key === 'instructions')?.lines).toHaveLength(4)
  })

  it('keeps every user table and key the installer does not own', () => {
    const merged = mergeInstallerConfig(buildConfigToml(), userConfig)

    for (const kept of [
      'notify = [ "C:\\\\Codex\\\\codex-computer-use.exe", "turn-ended" ]',
      '  "apply_patch",',
      '[not-a-table]',
      '[marketplaces.local-repo]',
      '[plugins."documents@openai-primary-runtime"]',
      '[projects."e:\\\\cc-gateway"]',
      '[mcp_servers.pencil]',
      'args = [ "--app", "visual_studio_code" ]',
      '[mcp_servers.pencil.env]',
      'keepRemoteControlAwakeWhilePluggedIn = true',
      'command = "a"',
      'command = "b"'
    ]) {
      expect(merged).toContain(kept)
    }
    expect(merged.match(/^\[\[hooks\.pre_tool_use\]\]$/gm)).toHaveLength(2)
  })

  it('lets installer-owned keys win and replaces [model_providers.cm]', () => {
    const merged = mergeInstallerConfig(buildConfigToml(), userConfig)

    expect(merged).toContain('model = "gpt-5.5"')
    expect(merged).not.toContain('gpt-6.1-sol')
    // service_tier is the user's choice; the installer no longer writes one
    expect(merged).toContain('service_tier = "priority"')
    expect(merged.match(/^service_tier = /gm)).toHaveLength(1)
    expect(merged).toContain('conversationDetailMode = "STEPS_COMMANDS"')
    expect(merged).not.toContain('STEPS_PROSE')
    expect(merged).not.toContain('old.example')
    expect(merged.match(/^model = /gm)).toHaveLength(1)
    expect(merged.match(/^\[desktop\]$/gm)).toHaveLength(1)
    expect(merged.match(/^\[model_providers\.cm\]$/gm)).toHaveLength(1)
  })

  it('puts root keys before the first table', () => {
    const merged = mergeInstallerConfig(buildConfigToml(), userConfig)
    const firstTable = merged.search(/^\[/m)
    expect(merged.indexOf('notify =')).toBeLessThan(firstTable)
    expect(merged.indexOf('personality =')).toBeLessThan(firstTable)
  })

  it('is idempotent: reinstalling twice gives the same file', () => {
    const once = mergeInstallerConfig(buildConfigToml(), userConfig)
    expect(mergeInstallerConfig(buildConfigToml(), once)).toBe(once)
  })

  it('merges keys into shared tables without replaceTables', () => {
    expect(mergeConfigToml('[a]\nx = 1', '[a]\nx = 0\ny = 2')).toBe('[a]\nx = 1\ny = 2')
  })

  it('install_codex.sh embeds the same merge as the TS installer', () => {
    // The shell renders its own template; only the algorithm must match.
    const rendered = buildConfigToml()
    const shell = runShellMerge(userConfig, rendered)
    expect(shell.replace(/\n$/, '')).toBe(mergeInstallerConfig(rendered, userConfig))
    expect(runShellMerge('', rendered).replace(/\n$/, '')).toBe(rendered)
  })
})
