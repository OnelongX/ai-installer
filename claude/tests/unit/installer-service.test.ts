import { describe, expect, it } from 'vitest'

import { createInstallerService } from '../../src/main/installer/service'

describe('installer service', () => {
  it('creates settings.json during environment loading when it is missing', async () => {
    const writes: Array<{ path: string; value: string }> = []
    const service = createInstallerService({
      exec: async () => ({
        exitCode: 0,
        stderr: '',
        stdout: ''
      }),
      fileExists: async () => false,
      mkdir: async () => {},
      rename: async () => {},
      userProfile: 'C:\\Users\\Administrator',
      writeFile: async (path, value) => {
        writes.push({ path, value })
      }
    })

    const environment = await service.loadEnvironment()

    expect(environment.some((item) => item.id === 'config' && item.status === 'satisfied')).toBe(true)
    expect(writes[0]?.path).toContain('.claude\\settings.json')
  })

  it('syncModels refuses without a key and writes nothing', async () => {
    const prevAuth = process.env.ANTHROPIC_AUTH_TOKEN
    const prevApi = process.env.ANTHROPIC_API_KEY
    delete process.env.ANTHROPIC_AUTH_TOKEN
    delete process.env.ANTHROPIC_API_KEY
    try {
      const writes: string[] = []
      const service = createInstallerService({
        exec: async () => ({ exitCode: 0, stderr: '', stdout: '' }),
        fileExists: async () => false,
        mkdir: async () => {},
        readFile: async () => {
          throw new Error('no settings.json')
        },
        rename: async () => {},
        userProfile: 'C:\\Users\\Administrator',
        writeFile: async (path) => {
          writes.push(path)
        }
      })

      const result = await service.syncModels({ provider: 'solaeon' })

      expect(result.ok).toBe(false)
      expect(result.message).toBeTruthy()
      expect(result.path).toContain('.claude\\settings.json')
      expect(writes).toHaveLength(0)
    } finally {
      if (prevAuth === undefined) delete process.env.ANTHROPIC_AUTH_TOKEN
      else process.env.ANTHROPIC_AUTH_TOKEN = prevAuth
      if (prevApi === undefined) delete process.env.ANTHROPIC_API_KEY
      else process.env.ANTHROPIC_API_KEY = prevApi
    }
  })

  it('runs the plan and returns an execution summary', async () => {
    const writes: Array<{ path: string; value: string }> = []
    const logMessages: string[] = []
    const service = createInstallerService({
      exec: async (command, args) => {
        if (command === 'claude' && args?.[0] === '--version') {
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
      rename: async () => {},
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
        summary: 'Install Claude on this machine',
        tasks: ['persist-anthropic-api-key', 'write-config', 'verify-claude-runtime']
      }
    })

    expect(result.status).toBe('ready')
    expect(result.claudeVersion).toBe('0.1.0')
    expect(writes[0]?.path).toContain('.claude\\settings.json')
    expect(logMessages.some((entry) => entry.startsWith('task-start:'))).toBe(true)
    expect(logMessages.some((entry) => entry.endsWith('verify-claude-runtime'))).toBe(true)
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
      rename: async () => {},
      userProfile: 'C:\\Users\\Administrator',
      writeFile: async () => {}
    })

    await service.startInstall({
      apiKey: 'sk-test-key',
      plan: {
        summary: 'Install Claude on this machine',
        tasks: ['install-claude']
      }
    })

    expect(execCalls).toContainEqual({
      args: ['i', '-g', '@anthropic-ai/claude-code'],
      command: 'npm'
    })
    expect(execCalls).not.toContainEqual({
      args: ['-Command', 'npm i -g @anthropic-ai/claude-code'],
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

        if (command === 'claude' && args?.[0] === '--version') {
          return {
            exitCode: 0,
            stderr: '',
            stdout: 'claude-cli 0.121.0\n'
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
      rename: async () => {},
      userProfile: 'C:\\Users\\Administrator',
      writeFile: async () => {}
    })

    const result = await service.startInstall({
      apiKey: 'sk-test-key',
      plan: {
        summary: 'Install Claude on this machine',
        tasks: ['install-node', 'verify-claude-runtime']
      }
    })

    expect(result.status).toBe('ready')
    expect(result.claudeVersion).toBe('claude-cli 0.121.0')
  })
})
