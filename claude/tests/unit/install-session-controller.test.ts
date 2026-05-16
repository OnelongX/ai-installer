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
        if (command === 'claude' && args?.[0] === '--version') {
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
        summary: 'Install Claude on this machine',
        tasks: ['write-config', 'verify-claude-runtime']
      }
    })

    expect(firstRun.status).toBe('failed')

    const secondRun = await controller.retryTask('verify-claude-runtime')

    expect(secondRun.status).toBe('ready')
    expect(secondRun.claudeVersion).toBe('0.1.0')

    const report = await controller.exportDiagnostics()
    expect(report).toContain('network timed out')
    expect(report).toContain('Claude 0.1.0 安装成功。')
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
          if (command === 'claude' && args?.[0] === '--version') {
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
        summary: 'Install Claude on this machine',
        tasks: ['write-config', 'verify-claude-runtime']
      }
    })

    expect(firstRun.status).toBe('failed')
    expect(storedSession).toContain('write-config')

    const secondController = createController()
    const recoveryState = await secondController.getRecoveryState()
    expect(recoveryState.available).toBe(true)
    expect(recoveryState.completedTasks).toEqual(['write-config'])
    expect(recoveryState.lastFailureAt).toBeDefined()
    expect(recoveryState.pendingTasks).toEqual(['verify-claude-runtime'])
    expect(recoveryState.recentLogs.at(-1)).toContain('network timed out')

    const resumed = await secondController.resumeInstall()

    expect(resumed.status).toBe('ready')
    expect(resumed.claudeVersion).toBe('0.2.0')
    expect(storedSession).toBeNull()
  })

  it('discards persisted sessions from an older installer version', async () => {
    let storedSession =
      '{"appVersion":"0.1.1","completedTasks":["write-config"],"logs":["旧版本日志"],"request":{"apiKey":"sk-test-key","plan":{"summary":"Install Claude on this machine","tasks":["write-config","verify-claude-runtime"]}},"summary":"旧版本会话"}'

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
