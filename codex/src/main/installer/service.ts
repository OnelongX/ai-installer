import path from 'node:path'

import type {
  DetectionItemData,
  GeneratePlanRequest,
  InstallExecutionResult,
  InstallLogEvent,
  StartInstallRequest,
  ValidationResult
} from '../../shared/ipc'
import { isApiKeyValueValid } from '../../renderer/features/api-key/api-key-state'
import { resolveProvider } from '../../shared/provider-config'
import { buildInstallPlan } from './plan'
import { createConfigDetectionItem } from './tasks/detect-config'
import { probeSolaeonInternal } from './tasks/detect-network'
import { detectCodex } from './tasks/detect-codex'
import { detectNode } from './tasks/detect-node'
import { detectSystem } from './tasks/detect-system'
import { getInstallCodexWindowsCommand } from './tasks/install-codex.windows'
import { getInstallNodeWindowsCommand } from './tasks/install-node.windows'
import { buildPersistApiKeyCommand } from './tasks/persist-api-key.windows'
import {
  buildConfigToml,
  ensureConfigToml,
  getConfigTomlPath
} from './tasks/write-config.windows'

type ExecResult = {
  exitCode: number
  stderr: string
  stdout: string
}

interface ExecOptions {
  timeoutMs?: number
}

interface InstallerServiceDeps {
  exec(command: string, args?: string[], options?: ExecOptions): Promise<ExecResult>
  fileExists(path: string): Promise<boolean>
  mkdir(path: string): Promise<void>
  onLog?(event: InstallLogEvent): Promise<void> | void
  userProfile: string
  writeFile(path: string, value: string): Promise<void>
}

const INSTALL_TIMEOUT_MS = 600_000
const VERIFY_TIMEOUT_MS = 60_000

function maskKey(apiKey: string) {
  const trimmed = apiKey.trim()

  if (trimmed.length < 6) {
    return '***'
  }

  return `${trimmed.slice(0, 2)}***${trimmed.slice(-4)}`
}

function toIssue(error: unknown) {
  const message = error instanceof Error ? error.message : '安装失败'
  const lowered = message.toLowerCase()

  if (lowered.includes('timed out') || lowered.includes('network')) {
    return {
      category: 'network',
      message,
      userAction: '检查网络连接后重试。'
    }
  }

  return {
    category: 'process',
    message,
    userAction: '查看日志输出后重试失败步骤。'
  }
}

async function detectInstalledBinary(
  exec: InstallerServiceDeps['exec'],
  command: string,
  args: string[]
) {
  try {
    const result = await exec(command, args)
    const output = result.stdout.trim()

    if (result.exitCode === 0 && output) {
      return output
    }
  } catch {
    return null
  }

  return null
}

async function refreshProcessPath(exec: InstallerServiceDeps['exec']) {
  try {
    const result = await exec(
      'powershell',
      [
        '-NoProfile',
        '-Command',
        "$m = [Environment]::GetEnvironmentVariable('Path','Machine'); $u = [Environment]::GetEnvironmentVariable('Path','User'); Write-Output ($m + ';' + $u)"
      ],
      { timeoutMs: VERIFY_TIMEOUT_MS }
    )

    const merged = result.stdout.trim()

    if (result.exitCode === 0 && merged) {
      process.env.PATH = merged
      return true
    }
  } catch {
    // Best effort — fallback paths in windows-command.ts still kick in.
  }

  return false
}

export function createInstallerService(deps: InstallerServiceDeps) {
  return {
    async loadEnvironment(): Promise<DetectionItemData[]> {
      const configBootstrap = await ensureConfigToml({
        fileExists: deps.fileExists,
        mkdir: deps.mkdir,
        userProfile: deps.userProfile,
        writeFile: deps.writeFile
      })

      return [
        await detectSystem(),
        await detectNode(),
        await detectCodex(),
        createConfigDetectionItem({
          configPath: configBootstrap.path,
          created: configBootstrap.created,
          exists: true
        })
      ]
    },

    async validateApiKey(input: string): Promise<ValidationResult> {
      if (!isApiKeyValueValid(input)) {
        return {
          message: 'API Key 必须是以 sk- 开头，或为 64 位长度的 token。',
          ok: false
        }
      }

      return { ok: true }
    },

    async generatePlan(input: GeneratePlanRequest) {
      return buildInstallPlan(input)
    },

    async probeNetwork() {
      const internalReachable = await probeSolaeonInternal()
      const resolved = resolveProvider('solaeon', 'auto', internalReachable)
      return {
        internalReachable,
        resolvedBaseUrl: resolved.baseUrl,
        network: resolved.network ?? 'external'
      }
    },

    async getExistingApiKey() {
      // OPENAI_API_KEY visible to this process is the same value the codex
      // CLI would pick up. If it's set, offer to reuse it; otherwise the
      // renderer hides the "continue with existing key" card entirely.
      const raw = process.env.OPENAI_API_KEY?.trim()
      if (!raw) {
        return { exists: false as const }
      }
      return { exists: true as const, mask: maskKey(raw) }
    },

    async startInstall(input: StartInstallRequest): Promise<InstallExecutionResult> {
      const logs: string[] = []
      const configPath = getConfigTomlPath(deps.userProfile)
      let codexVersion = 'unknown'
      let activeTask = 'bootstrap'

      const emitLog = async (event: InstallLogEvent) => {
        logs.push(event.message)
        await deps.onLog?.(event)
      }

      const emitCommandResult = async (taskId: string, result: ExecResult) => {
        const stdout = result.stdout.trim()
        const stderr = result.stderr.trim()

        if (stdout) {
          await emitLog({
            level: 'info',
            message: stdout,
            taskId,
            type: 'task-output'
          })
        }

        if (stderr) {
          await emitLog({
            level: 'error',
            message: stderr,
            taskId,
            type: 'task-output'
          })
        }
      }

      try {
        for (const task of input.plan.tasks) {
          activeTask = task
          await emitLog({
            level: 'info',
            message: `开始执行：${task}`,
            taskId: task,
            type: 'task-start'
          })

          switch (task) {
            case 'install-node': {
              const command = getInstallNodeWindowsCommand()
              await emitLog({
                level: 'info',
                message: [command.command, ...command.args].join(' '),
                taskId: task,
                type: 'task-output'
              })
              const result = await deps.exec(command.command, command.args, {
                timeoutMs: INSTALL_TIMEOUT_MS
              })
              // Pull the freshly written user/machine PATH back into this
              // process so that the subsequent npm step can find npm.cmd
              // even if winget installed Node to a non-default location.
              await refreshProcessPath(deps.exec)
              if (result.exitCode !== 0) {
                const detectedNodeVersion = await detectInstalledBinary(deps.exec, 'node', ['-v'])

                if (!detectedNodeVersion) {
                  throw new Error(result.stderr || result.stdout || 'Node.js 安装失败')
                }

                await emitLog({
                  level: 'info',
                  message: `安装命令返回非零，但已检测到 ${detectedNodeVersion}，继续后续步骤。`,
                  taskId: task,
                  type: 'task-output'
                })
              }
              await emitCommandResult(task, result)
              break
            }
            case 'install-codex': {
              const command = getInstallCodexWindowsCommand()
              await emitLog({
                level: 'info',
                message: [command.command, ...command.args].join(' '),
                taskId: task,
                type: 'task-output'
              })
              const result = await deps.exec(command.command, command.args, {
                timeoutMs: INSTALL_TIMEOUT_MS
              })
              // npm puts codex.cmd into the global prefix (default %APPDATA%\npm),
              // which may not yet be on this process's PATH.
              await refreshProcessPath(deps.exec)
              if (result.exitCode !== 0) {
                throw new Error(result.stderr || 'Codex 安装失败')
              }
              await emitCommandResult(task, result)
              break
            }
            case 'persist-openai-api-key': {
              const command = buildPersistApiKeyCommand(input.apiKey)
              await emitLog({
                level: 'info',
                message:
                  '[Environment]::SetEnvironmentVariable("OPENAI_API_KEY", "***", "User")',
                taskId: task,
                type: 'task-output'
              })
              const result = await deps.exec(
                'powershell',
                ['-NoProfile', '-Command', command],
                { timeoutMs: VERIFY_TIMEOUT_MS }
              )
              if (result.exitCode !== 0) {
                throw new Error(result.stderr || 'API Key 写入失败')
              }
              await emitCommandResult(task, result)
              break
            }
            case 'write-config': {
              const providerId = input.provider ?? 'livetoken'
              const networkMode = input.networkMode ?? 'auto'

              // For Solaeon in auto mode, probe the LAN box now and pick the
              // reachable address. livetoken and forced internal/external skip
              // the probe entirely.
              let internalReachable = false
              if (providerId === 'solaeon' && networkMode === 'auto') {
                internalReachable = await probeSolaeonInternal()
                await emitLog({
                  level: 'info',
                  message: internalReachable
                    ? '内网 192.168.1.101:48760 可达，使用内网地址'
                    : '内网不可达，回落到外网 ai-api.solaeon.com',
                  taskId: task,
                  type: 'task-output'
                })
              }

              const resolvedProvider = resolveProvider(
                providerId,
                networkMode,
                internalReachable
              )

              await emitLog({
                level: 'info',
                message: `写入 ${configPath}（provider=${resolvedProvider.name}, base_url=${resolvedProvider.baseUrl}）`,
                taskId: task,
                type: 'task-output'
              })
              await deps.mkdir(path.dirname(configPath))
              await deps.writeFile(
                configPath,
                buildConfigToml({ provider: resolvedProvider })
              )
              break
            }
            case 'verify-codex-runtime': {
              await emitLog({
                level: 'info',
                message: 'codex --version',
                taskId: task,
                type: 'task-output'
              })
              const result = await deps.exec('codex', ['--version'], {
                timeoutMs: VERIFY_TIMEOUT_MS
              })
              if (result.exitCode !== 0) {
                throw new Error(result.stderr || 'Codex 验证失败')
              }
              await emitCommandResult(task, result)
              codexVersion = result.stdout.trim() || 'unknown'
              break
            }
            default:
              await emitLog({
                level: 'info',
                message: task,
                taskId: task,
                type: 'task-output'
              })
          }

          await emitLog({
            level: 'info',
            message: `已完成：${task}`,
            taskId: task,
            type: 'task-complete'
          })
        }

        return {
          codexVersion,
          configPath,
          keyMask: maskKey(input.apiKey),
          logs,
          status: 'ready'
        }
      } catch (error) {
        await emitLog({
          level: 'error',
          message: error instanceof Error ? error.message : '安装失败',
          taskId: activeTask,
          type: 'task-failed'
        })

        return {
          issue: toIssue(error),
          logs,
          status: 'failed'
        }
      }
    }
  }
}
