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
import {
  clearOAuthCredentials,
  detectOAuthCredentials,
  getOAuthCredentialsPath
} from './tasks/clear-anthropic-oauth'
import { createConfigDetectionItem } from './tasks/detect-config'
import { checkGatewayModels, fetchClaudeModels } from './tasks/detect-gateway'
import { mergeClaudeModels } from '../../shared/model-catalog'
import { detectClaude } from './tasks/detect-claude'
import { detectNode } from './tasks/detect-node'
import { detectSystem } from './tasks/detect-system'
import { getInstallClaudeWindowsCommand } from './tasks/install-claude.windows'
import { getInstallNodeWindowsCommand } from './tasks/install-node.windows'
import { buildPersistApiKeyCommand } from './tasks/persist-api-key.windows'
import { buildWriteRegistryCommand } from './tasks/write-registry.windows'
import {
  buildSettingsJson,
  ensureSettingsJson,
  getSettingsJsonPath,
  updateAvailableModels
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
  readFile(path: string): Promise<string>
  rename(from: string, to: string): Promise<void>
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
      const configBootstrap = await ensureSettingsJson({
        fileExists: deps.fileExists,
        mkdir: deps.mkdir,
        userProfile: deps.userProfile,
        writeFile: deps.writeFile
      })

      return [
        await detectSystem(),
        await detectNode(),
        await detectClaude(),
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
      const oauth = await detectOAuthCredentials(
        { fileExists: deps.fileExists },
        deps.userProfile
      )
      return buildInstallPlan({ ...input, oauthCredentialsExist: oauth.exists })
    },

    async getExistingApiKey() {
      // The token visible to this process is what a fresh `claude` would pick
      // up. If it's set, offer to reuse it; otherwise the renderer hides the
      // "continue with existing key" card entirely.
      const raw = (
        process.env.ANTHROPIC_AUTH_TOKEN ??
        process.env.ANTHROPIC_API_KEY ??
        ''
      ).trim()
      if (!raw) {
        return { exists: false as const }
      }
      return { exists: true as const, mask: maskKey(raw) }
    },

    async syncModels(input: { apiKey?: string; provider?: 'solaeon' | 'livetoken' }) {
      // Refresh the model list in BOTH client surfaces without a reinstall:
      //   settings.json  → availableModels (Claude Code CLI)
      //   registry       → inferenceModels (Claude Desktop)
      const provider = resolveProvider(input.provider)
      const settingsPath = getSettingsJsonPath(deps.userProfile)

      let existingRaw: string | null = null
      try {
        existingRaw = await deps.readFile(settingsPath)
      } catch {
        existingRaw = null
      }

      // Key: explicit input → env → the token already in settings.json.
      let apiKey =
        input.apiKey?.trim() ||
        process.env.ANTHROPIC_AUTH_TOKEN?.trim() ||
        process.env.ANTHROPIC_API_KEY?.trim() ||
        ''
      if (!apiKey && existingRaw) {
        try {
          const env = (JSON.parse(existingRaw) as { env?: Record<string, string> }).env
          apiKey = env?.ANTHROPIC_AUTH_TOKEN?.trim() || ''
        } catch {
          apiKey = ''
        }
      }
      if (!apiKey) {
        return {
          ok: false as const,
          count: 0,
          path: settingsPath,
          message: '未找到 API Key：请先在上方填入 Key，或完成一次安装。'
        }
      }

      if (!/^https:\/\//i.test(provider.baseUrl)) {
        return {
          ok: false as const,
          count: 0,
          path: settingsPath,
          message: `Claude 仅支持 HTTPS 网关，但 ${provider.name} 是 ${provider.baseUrl}`
        }
      }

      const gateway = await fetchClaudeModels(provider, apiKey)
      if (gateway.length === 0) {
        return {
          ok: false as const,
          count: 0,
          path: settingsPath,
          message: `网关 ${provider.name} 未返回模型（鉴权失败或不可达），已保留现有列表。`
        }
      }

      const models = mergeClaudeModels(gateway)
      const modelIds = models.map((m) => m.name)

      // 1) settings.json — update in place so the auth token / customisations
      //    survive; write a fresh one only if it doesn't exist yet.
      const nextSettings = existingRaw
        ? updateAvailableModels(existingRaw, modelIds, { provider, apiKey })
        : buildSettingsJson({ provider, apiKey, availableModelIds: modelIds })
      await deps.mkdir(path.dirname(settingsPath))
      await deps.writeFile(settingsPath, nextSettings)

      // 2) registry — rewrite the managed Desktop config with the full list.
      const command = buildWriteRegistryCommand(provider, apiKey, models)
      const result = await deps.exec('powershell', ['-NoProfile', '-Command', command], {
        timeoutMs: VERIFY_TIMEOUT_MS
      })
      const registryOk = result.exitCode === 0

      return {
        ok: true as const,
        count: models.length,
        gatewayCount: gateway.length,
        registryOk,
        path: settingsPath,
        message: registryOk
          ? undefined
          : 'settings.json 已更新，但 Desktop 注册表写入失败（Claude Code CLI 不受影响）。'
      }
    },

    async startInstall(input: StartInstallRequest): Promise<InstallExecutionResult> {
      const logs: string[] = []
      const configPath = getSettingsJsonPath(deps.userProfile)
      const provider = resolveProvider(input.provider)
      let claudeVersion = 'unknown'
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
            case 'install-claude': {
              const command = getInstallClaudeWindowsCommand()
              await emitLog({
                level: 'info',
                message: [command.command, ...command.args].join(' '),
                taskId: task,
                type: 'task-output'
              })
              const result = await deps.exec(command.command, command.args, {
                timeoutMs: INSTALL_TIMEOUT_MS
              })
              // npm puts claude.cmd into the global prefix (default %APPDATA%\npm),
              // which may not yet be on this process's PATH.
              await refreshProcessPath(deps.exec)
              if (result.exitCode !== 0) {
                throw new Error(result.stderr || 'Claude 安装失败')
              }
              await emitCommandResult(task, result)
              break
            }
            case 'persist-anthropic-api-key': {
              const command = buildPersistApiKeyCommand(input.apiKey)
              await emitLog({
                level: 'info',
                message:
                  '[Environment]::SetEnvironmentVariable("ANTHROPIC_AUTH_TOKEN", "***", "User")',
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
            case 'clear-anthropic-oauth': {
              const credPath = getOAuthCredentialsPath(deps.userProfile)
              await emitLog({
                level: 'info',
                message: `检测 ${credPath}`,
                taskId: task,
                type: 'task-output'
              })
              const result = await clearOAuthCredentials(
                { fileExists: deps.fileExists, rename: deps.rename },
                deps.userProfile
              )
              if (result.cleared) {
                await emitLog({
                  level: 'info',
                  message: `已备份并移除官方 OAuth 凭据 → ${result.backupPath}`,
                  taskId: task,
                  type: 'task-output'
                })
              } else {
                await emitLog({
                  level: 'info',
                  message: '没有发现官方 OAuth 凭据，跳过',
                  taskId: task,
                  type: 'task-output'
                })
              }
              break
            }
            case 'verify-gateway': {
              await emitLog({
                level: 'info',
                message: `GET ${provider.baseUrl}/v1/models`,
                taskId: task,
                type: 'task-output'
              })
              const check = await checkGatewayModels(provider, input.apiKey)
              if (!check.ok) {
                const reason = check.error
                  ? check.error
                  : `网关缺少模型：${check.missing.join(', ')}`
                throw new Error(`网关验证失败（${provider.name}）：${reason}`)
              }
              await emitLog({
                level: 'info',
                message: `网关 ${provider.name} 就绪，已返回全部 ${check.discovered.length} 个模型`,
                taskId: task,
                type: 'task-output'
              })
              break
            }
            case 'write-config': {
              await emitLog({
                level: 'info',
                message: `写入 ${configPath}（provider=${provider.name}, base_url=${provider.baseUrl}）`,
                taskId: task,
                type: 'task-output'
              })
              await deps.mkdir(path.dirname(configPath))
              await deps.writeFile(
                configPath,
                buildSettingsJson({ provider, apiKey: input.apiKey })
              )
              break
            }
            case 'write-desktop-registry': {
              await emitLog({
                level: 'info',
                message: `写入 HKCU\\Software\\Policies\\Claude（Desktop 托管配置，7 模型）`,
                taskId: task,
                type: 'task-output'
              })
              const command = buildWriteRegistryCommand(provider, input.apiKey)
              const result = await deps.exec('powershell', ['-NoProfile', '-Command', command], {
                timeoutMs: VERIFY_TIMEOUT_MS
              })
              if (result.exitCode !== 0) {
                throw new Error(result.stderr || 'Claude Desktop 注册表配置写入失败')
              }
              await emitCommandResult(task, result)
              break
            }
            case 'verify-claude-runtime': {
              await emitLog({
                level: 'info',
                message: 'claude --version',
                taskId: task,
                type: 'task-output'
              })
              const result = await deps.exec('claude', ['--version'], {
                timeoutMs: VERIFY_TIMEOUT_MS
              })
              if (result.exitCode !== 0) {
                throw new Error(result.stderr || 'Claude 验证失败')
              }
              await emitCommandResult(task, result)
              claudeVersion = result.stdout.trim() || 'unknown'
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
          claudeVersion,
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
