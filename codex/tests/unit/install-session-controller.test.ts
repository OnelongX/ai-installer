import { describe, expect, it } from 'vitest'
import { createInstallSessionController } from '../../src/main/installer/session-controller'

describe('install session controller', () => {
  it('retries from the failed task and exports diagnostics', async () => {
    let verifyAttempts = 0
    let storedSession: string | null = null
    const controller = createInstallSessionController({
      appVersion: '0.1.2',
      clearSession: async () => {
        storedSession = null
      },
      exec: async (command, args) => {
        if (command === 'codex' && args?.[0] === '--version') {
          verifyAttempts += 1

          if (verifyAttempts === 1) {
            return {
              exitCode: 1,
              stderr: 'network timed out',
              stdout: ''
            }
          }

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
      loadSession: async () => storedSession,
      mkdir: async () => {},
      platform: 'win32',
      saveSession: async (serialized) => {
        storedSession = serialized
      },
      userProfile: 'C:\\Users\\Administrator',
      writeFile: async () => {}
    })

    const firstRun = await controller.startInstall({
      apiKey: 'sk-test-key',
      plan: {
        summary: 'Install Codex on this machine',
        tasks: ['write-config', 'verify-codex-runtime']
      }
    })

    expect(firstRun.status).toBe('failed')

    const secondRun = await controller.retryTask('verify-codex-runtime')

    expect(secondRun).toMatchObject({ status: 'ready', codexVersion: '0.1.0' })

    const report = await controller.exportDiagnostics()
    expect(report).toContain('network timed out')
    expect(report).toContain('Codex 0.1.0 安装成功。')
  })

  it('hydrates a persisted failed session and resumes after restart', async () => {
    let verifyAttempts = 0
    let storedSession: string | null = null

    const createController = () =>
      createInstallSessionController({
        appVersion: '0.1.2',
        clearSession: async () => {
          storedSession = null
        },
        exec: async (command, args) => {
          if (command === 'codex' && args?.[0] === '--version') {
            verifyAttempts += 1

            if (verifyAttempts === 1) {
              return {
                exitCode: 1,
                stderr: 'network timed out',
                stdout: ''
              }
            }

            return {
              exitCode: 0,
              stderr: '',
              stdout: '0.2.0'
            }
          }

          return {
            exitCode: 0,
            stderr: '',
            stdout: ''
          }
        },
        fileExists: async () => true,
        loadSession: async () => storedSession,
        mkdir: async () => {},
        platform: 'win32',
        protectSecret: (plain) => `enc(${plain})`,
        revealSecret: (cipher) => cipher.slice(4, -1),
        saveSession: async (serialized) => {
          storedSession = serialized
        },
        userProfile: 'C:\\Users\\Administrator',
        writeFile: async () => {}
      })

    const firstController = createController()
    const firstRun = await firstController.startInstall({
      apiKey: 'sk-test-key',
      plan: {
        summary: 'Install Codex on this machine',
        tasks: ['write-config', 'verify-codex-runtime']
      }
    })

    expect(firstRun.status).toBe('failed')
    expect(storedSession).toContain('write-config')
    // the key survives only as a cipher, never in plain text
    expect(storedSession).not.toContain('"sk-test-key"')
    expect(JSON.parse(storedSession!).request).toMatchObject({
      apiKeyCipher: 'enc(sk-test-key)',
      hasApiKey: true
    })

    const secondController = createController()
    const recoveryState = await secondController.getRecoveryState()
    expect(recoveryState.available).toBe(true)
    expect(recoveryState.completedTasks).toEqual(['write-config'])
    expect(recoveryState.lastFailureAt).toBeDefined()
    expect(recoveryState.pendingTasks).toEqual(['verify-codex-runtime'])
    expect(recoveryState.recentLogs.at(-1)).toContain('network timed out')

    const resumed = await secondController.resumeInstall()

    expect(resumed).toMatchObject({ status: 'ready', codexVersion: '0.2.0' })
    expect(storedSession).toBeNull()
  })

  describe('API key in the session file', () => {
    const failingVerify = async (command: string, args?: string[]) =>
      command === 'codex' && args?.[0] === '--version'
        ? { exitCode: 1, stderr: 'network timed out', stdout: '' }
        : { exitCode: 0, stderr: '', stdout: '' }

    function setup(
      secrets: { protectSecret?(plain: string): string; revealSecret?(cipher: string): string },
      initial: string | null = null
    ) {
      const disk = { session: initial as string | null }
      const create = () =>
        createInstallSessionController({
          appVersion: '0.1.2',
          clearSession: async () => {
            disk.session = null
          },
          exec: failingVerify,
          fileExists: async () => true,
          loadSession: async () => disk.session,
          mkdir: async () => {},
          platform: 'win32',
          saveSession: async (serialized) => {
            disk.session = serialized
          },
          userProfile: 'C:\\Users\\Administrator',
          writeFile: async () => {},
          ...secrets
        })
      return { create, disk }
    }

    const request = (apiKey: string) => ({
      apiKey,
      plan: { summary: 'Install Codex', tasks: ['write-config', 'verify-codex-runtime'] }
    })

    it('leaves the key out (and refuses to resume) when it cannot be encrypted', async () => {
      const { create, disk } = setup({
        protectSecret: () => {
          throw new Error('encryption unavailable')
        }
      })
      await create().startInstall(request('sk-test-key'))

      expect(disk.session).not.toContain('sk-test-key')
      expect((await create().getRecoveryState()).available).toBe(false)
      expect(disk.session).toBeNull()
    })

    it('drops a session whose key cannot be decrypted any more', async () => {
      const { create, disk } = setup({
        protectSecret: (plain) => `enc(${plain})`,
        revealSecret: () => {
          throw new Error('wrong user')
        }
      })
      await create().startInstall(request('sk-test-key'))

      expect((await create().getRecoveryState()).available).toBe(false)
      expect(disk.session).toBeNull()
    })

    it('resumes the existing-key mode, which has no key to store', async () => {
      const { create } = setup({})
      await create().startInstall(request(''))

      expect((await create().getRecoveryState()).available).toBe(true)
    })

    it('re-encrypts a plain key left by an older session file', async () => {
      const legacy = JSON.stringify({
        appVersion: '0.1.2',
        completedTasks: ['write-config'],
        logs: [],
        request: request('sk-legacy-key'),
        summary: '旧会话'
      })
      const { create, disk } = setup(
        { protectSecret: (plain) => `enc(${plain})`, revealSecret: (cipher) => cipher.slice(4, -1) },
        legacy
      )

      expect((await create().getRecoveryState()).available).toBe(true)
      expect(disk.session).not.toContain('"sk-legacy-key"')
      expect(disk.session).toContain('enc(sk-legacy-key)')
    })
  })

  it('discards persisted sessions from an older installer version', async () => {
    let storedSession: string | null =
      '{"appVersion":"0.1.1","completedTasks":["write-config"],"logs":["旧版本日志"],"request":{"apiKey":"sk-test-key","plan":{"summary":"Install Codex on this machine","tasks":["write-config","verify-codex-runtime"]}},"summary":"旧版本会话"}'

    const controller = createInstallSessionController({
      appVersion: '0.1.2',
      clearSession: async () => {
        storedSession = null
      },
      exec: async () => ({
        exitCode: 0,
        stderr: '',
        stdout: ''
      }),
      fileExists: async () => true,
      loadSession: async () => storedSession,
      mkdir: async () => {},
      platform: 'win32',
      saveSession: async (serialized) => {
        storedSession = serialized
      },
      userProfile: 'C:\\Users\\Administrator',
      writeFile: async () => {}
    })

    const recoveryState = await controller.getRecoveryState()

    expect(recoveryState.available).toBe(false)
    expect(storedSession).toBeNull()
  })
})
