import { describe, expect, it } from 'vitest'

import { createInstallerService } from '../../src/main/installer/service'

describe('installer service', () => {
  it('only detects config.toml during environment loading, never writes it', async () => {
    const writes: Array<{ path: string; value: string }> = []
    const service = createInstallerService({
      exec: async () => ({
        exitCode: 0,
        stderr: '',
        stdout: ''
      }),
      fileExists: async () => false,
      mkdir: async () => {},
      userProfile: 'C:\\Users\\Administrator',
      writeFile: async (path, value) => {
        writes.push({ path, value })
      }
    })

    const environment = await service.loadEnvironment()

    expect(environment.find((item) => item.id === 'config')?.status).toBe('auto-fixable')
    expect(writes).toEqual([])
  })

  it('runs the plan and returns an execution summary', async () => {
    const writes: Array<{ path: string; value: string }> = []
    const logMessages: string[] = []
    const service = createInstallerService({
      exec: async (command, args) => {
        if (command === 'codex' && args?.[0] === '--version') {
          return {
            exitCode: 0,
            stderr: '',
            stdout: '0.1.0'
          }
        }

        return {
          exitCode: 0,
          stderr: '',
          stdout: ''
        }
      },
      fileExists: async () => true,
      mkdir: async () => {},
      onLog: (event) => {
        logMessages.push(`${event.type}:${event.message}`)
      },
      userProfile: 'C:\\Users\\Administrator',
      writeFile: async (path, value) => {
        writes.push({ path, value })
      }
    })

    const result = await service.startInstall({
      apiKey: 'sk-test-key',
      plan: {
        summary: 'Install Codex on this machine',
        tasks: ['persist-openai-api-key', 'write-config', 'verify-codex-runtime']
      }
    })

    expect(result).toMatchObject({ status: 'ready', codexVersion: '0.1.0' })
    expect(writes[0]?.path).toContain('.codex\\config.toml')
    expect(logMessages.some((entry) => entry.startsWith('task-start:'))).toBe(true)
    expect(logMessages.some((entry) => entry.endsWith('verify-codex-runtime'))).toBe(true)
  })

  it('write-config backs up, keeps existing [desktop] settings and forces STEPS_COMMANDS', async () => {
    const writes: Array<{ path: string; value: string }> = []
    const service = createInstallerService({
      exec: async () => ({ exitCode: 0, stderr: '', stdout: '' }),
      fileExists: async () => true,
      mkdir: async () => {},
      readFile: async (path) =>
        path.endsWith('config.toml')
          ? '[desktop]\nfollowUpQueueMode = "queue"\nconversationDetailMode = "STEPS_PROSE"\n'
          : null,
      userProfile: 'C:\\Users\\Administrator',
      writeFile: async (path, value) => {
        writes.push({ path, value })
      }
    })

    await service.startInstall({
      apiKey: 'sk-test-key',
      plan: {
        summary: 'Install Codex on this machine',
        tasks: ['write-config']
      }
    })

    const config = writes.find((entry) => entry.path.endsWith('config.toml'))?.value ?? ''
    expect(config).toContain(
      '[desktop]\nconversationDetailMode = "STEPS_COMMANDS"\nfollowUpQueueMode = "queue"'
    )
    expect(config).not.toContain('STEPS_PROSE')

    // The previous file is backed up before it is rewritten.
    const backupIndex = writes.findIndex((entry) => entry.path.includes('config.toml.bak-installer-'))
    expect(backupIndex).toBeGreaterThanOrEqual(0)
    expect(writes[backupIndex].value).toContain('STEPS_PROSE')
    expect(backupIndex).toBeLessThan(writes.findIndex((entry) => entry.path.endsWith('config.toml')))
  })

  it('syncModels refuses (and does not write) when config.toml is not on the gateway', async () => {
    const prev = process.env.OPENAI_API_KEY
    delete process.env.OPENAI_API_KEY
    try {
      const writes: string[] = []
      const service = createInstallerService({
        exec: async () => ({ exitCode: 0, stderr: '', stdout: '' }),
        fileExists: async () => true,
        mkdir: async () => {},
        userProfile: 'C:\\Users\\Administrator',
        writeFile: async (path) => {
          writes.push(path)
        }
      })

      const result = await service.syncModels({ provider: 'solaeon' })

      // no readFile → no config.toml → Codex isn't using the gateway catalog
      expect(result).toMatchObject({ ok: false, notWired: true })
      expect(result.message).toContain('没有接入 SolaEon 网关')
      expect(result.path).toContain('.codex\\models-catalog.json')
      expect(writes).toHaveLength(0)
    } finally {
      if (prev === undefined) {
        delete process.env.OPENAI_API_KEY
      } else {
        process.env.OPENAI_API_KEY = prev
      }
    }
  })

  it('does not run npm installation through powershell', async () => {
    const execCalls: Array<{ args?: string[]; command: string }> = []
    const service = createInstallerService({
      exec: async (command, args) => {
        execCalls.push({ args, command })

        return {
          exitCode: 0,
          stderr: '',
          stdout: ''
        }
      },
      fileExists: async () => true,
      mkdir: async () => {},
      userProfile: 'C:\\Users\\Administrator',
      writeFile: async () => {}
    })

    await service.startInstall({
      apiKey: 'sk-test-key',
      plan: {
        summary: 'Install Codex on this machine',
        tasks: ['install-codex']
      }
    })

    expect(execCalls).toContainEqual({
      args: ['i', '-g', '@openai/codex'],
      command: 'npm'
    })
    expect(execCalls).not.toContainEqual({
      args: ['-Command', 'npm i -g @openai/codex'],
      command: 'powershell'
    })
  })

  it('treats node installation as successful when Node is already available after a non-zero winget result', async () => {
    const service = createInstallerService({
      exec: async (command, args) => {
        if (command === 'winget') {
          return {
            exitCode: 1,
            stderr: '',
            stdout: 'A newer version is already installed.'
          }
        }

        if (command === 'node' && args?.[0] === '-v') {
          return {
            exitCode: 0,
            stderr: '',
            stdout: 'v24.14.0\n'
          }
        }

        if (command === 'codex' && args?.[0] === '--version') {
          return {
            exitCode: 0,
            stderr: '',
            stdout: 'codex-cli 0.121.0\n'
          }
        }

        return {
          exitCode: 0,
          stderr: '',
          stdout: ''
        }
      },
      fileExists: async () => true,
      mkdir: async () => {},
      userProfile: 'C:\\Users\\Administrator',
      writeFile: async () => {}
    })

    const result = await service.startInstall({
      apiKey: 'sk-test-key',
      plan: {
        summary: 'Install Codex on this machine',
        tasks: ['install-node', 'verify-codex-runtime']
      }
    })

    expect(result).toMatchObject({ status: 'ready', codexVersion: 'codex-cli 0.121.0' })
  })
})
