// Windows-only module: always build Windows paths, so behaviour (and the unit
// tests, which CI runs on Linux) is the same on every OS.
import { win32 as path } from 'node:path'

import type {
  DetectionItemData,
  GeneratePlanRequest,
  InstallExecutionResult,
  InstallLogEvent,
  StartInstallRequest,
  ValidationResult
} from '../../shared/ipc'
import { isApiKeyValueValid } from '../../renderer/features/api-key/api-key-state'
import {
  geminiBaseUrl,
  switchTargets,
  type DeleteGatewayProfileResult,
  type GatewayProfilesState,
  type SaveGatewayProfileResult,
  type SaveGatewayProfileRequest,
  type SwitchGatewayRequest,
  type SwitchGatewayResult,
  type SwitchTargetResult
} from '../../shared/gateway-switch'
import {
  DEFAULT_PROVIDER,
  isNetworkMode,
  isProviderId,
  resolveProvider,
  type NetworkMode,
  type ProviderId,
  type ResolvedProvider
} from '../../shared/provider-config'
import { maskKey, type GatewayProfileStore } from './gateway-profiles'
import { buildInstallPlan } from './plan'
import { buildModelCatalog } from '../../shared/model-catalog'
import { checkGatewayReachable, fetchGatewayModels, probeGeminiApi } from './tasks/detect-gateway'
import { createConfigDetectionItem } from './tasks/detect-config'
import { probeSolaeonInternal } from './tasks/detect-network'
import { detectCodex } from './tasks/detect-codex'
import { detectNode } from './tasks/detect-node'
import { detectSystem } from './tasks/detect-system'
import { getInstallCodexWindowsCommand } from './tasks/install-codex.windows'
import { getInstallNodeWindowsCommand } from './tasks/install-node.windows'
import {
  buildPersistGeminiEnvCommand,
  getGeminiSettingsPath,
  mergeGeminiSettings
} from './tasks/gemini-config'
import { buildPersistApiKeyCommand } from './tasks/persist-api-key.windows'
import {
  buildConfigToml,
  buildGatewayConfigToml,
  getConfigBackupPath,
  getConfigTomlPath,
  getModelCatalogPath,
  mergeInstallerConfig
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
  /** saved gateway profiles for 切换网关 (absent in tests that don't need it) */
  profiles?: GatewayProfileStore
  /** Returns null when the file is missing; used to keep existing [desktop] settings. */
  readFile?(path: string): Promise<string | null>
  userProfile: string
  writeFile(path: string, value: string): Promise<void>
}

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error))

const INSTALL_TIMEOUT_MS = 600_000
const VERIFY_TIMEOUT_MS = 60_000

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
  const runPowerShell = (command: string) =>
    deps.exec('powershell', ['-NoProfile', '-Command', command], { timeoutMs: VERIFY_TIMEOUT_MS })

  /** Back up `filePath` (if it has content) and write `value` over it. */
  async function writeWithBackup(filePath: string, existing: string | null, value: string) {
    await deps.mkdir(path.dirname(filePath))
    let backupPath: string | undefined
    if (existing?.trim()) {
      backupPath = getConfigBackupPath(filePath)
      await deps.writeFile(backupPath, existing)
    }
    await deps.writeFile(filePath, value)
    return backupPath
  }

  // Merge the installer-owned keys into config.toml (mcp_servers / plugins /
  // projects / desktop prefs are kept) and rebuild models-catalog.json from the
  // live /v1/models list + EXTRA_MODELS. Shared by the install run ('full':
  // gateway + default preferences) and 切换网关 ('gateway': gateway keys only,
  // so the user's reasoning effort / sandbox / approval settings survive).
  async function writeCodexConfig(
    provider: ResolvedProvider,
    model: string | undefined,
    apiKey: string,
    scope: 'full' | 'gateway'
  ) {
    const configPath = getConfigTomlPath(deps.userProfile)
    const catalogPath = getModelCatalogPath(deps.userProfile)
    const existing = (await deps.readFile?.(configPath)) ?? null
    const render = scope === 'full' ? buildConfigToml : buildGatewayConfigToml
    const backupPath = await writeWithBackup(
      configPath,
      existing,
      mergeInstallerConfig(render({ provider, model, catalogPath }), existing)
    )

    const gatewayModels = await fetchGatewayModels(provider, apiKey)
    const catalog = buildModelCatalog(gatewayModels.map((m) => m.id))
    await deps.writeFile(catalogPath, JSON.stringify(catalog, null, 2))

    return { backupPath, catalogCount: catalog.models.length, gatewayCount: gatewayModels.length }
  }

  async function resolveForProfile(providerId: ProviderId, networkMode: NetworkMode) {
    const internalReachable =
      providerId === 'solaeon' && networkMode === 'auto' ? await probeSolaeonInternal() : false
    return resolveProvider(providerId, networkMode, internalReachable)
  }

  function requireProfiles() {
    if (!deps.profiles) {
      throw new Error('网关配置存储不可用')
    }
    return deps.profiles
  }

  async function switchCodex(provider: ResolvedProvider, model: string, apiKey: string) {
    const written = await writeCodexConfig(provider, model, apiKey, 'gateway')
    const persisted = await runPowerShell(buildPersistApiKeyCommand(apiKey))
    if (persisted.exitCode !== 0) {
      throw new Error(persisted.stderr || 'OPENAI_API_KEY 写入失败')
    }
    // So this process (getExistingApiKey, 更新模型目录) sees the new key too.
    process.env.OPENAI_API_KEY = apiKey
    return [
      `已切到 ${provider.name}（${provider.baseUrl}），模型 ${model}`,
      `模型目录 ${written.catalogCount} 个（网关 ${written.gatewayCount} + 内置补充）`,
      written.backupPath ? `原配置已备份 → ${written.backupPath}` : ''
    ]
      .filter(Boolean)
      .join('；')
  }

  async function switchGemini(provider: ResolvedProvider, model: string, apiKey: string) {
    if (!deps.readFile) {
      throw new Error('无法读取 Gemini 配置')
    }
    // Check the gateway actually serves the Gemini API before touching anything:
    // writing settings + env vars for a gateway that can't answer would leave
    // Gemini CLI retrying "fetch failed" forever.
    const baseUrl = geminiBaseUrl(provider.baseUrl)
    if (!(await probeGeminiApi(baseUrl, apiKey))) {
      throw new Error(
        provider.network === 'external'
          ? `SolaEon 外网网关（${baseUrl}）目前没有开放 Gemini 接口（/v1beta），Gemini CLI 未做修改。请在公司内网用「Solaeon · 内网」或「Solaeon · 自动」切换，或联系网关管理员开放外网 Gemini 接口。`
          : `网关 ${baseUrl} 的 Gemini 接口（/v1beta）连不上，Gemini CLI 未做修改。`
      )
    }

    const settingsPath = getGeminiSettingsPath(deps.userProfile)
    const existing = await deps.readFile(settingsPath)
    let merged: string
    try {
      merged = mergeGeminiSettings(existing, model)
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error)
      throw new Error(`${settingsPath} 无法解析（${reason}），未做修改，请先修正该文件`)
    }
    const backupPath = await writeWithBackup(settingsPath, existing, merged)

    const persisted = await runPowerShell(buildPersistGeminiEnvCommand(apiKey, baseUrl))
    if (persisted.exitCode !== 0) {
      throw new Error(persisted.stderr || 'GEMINI_API_KEY 写入失败')
    }
    process.env.GEMINI_API_KEY = apiKey
    process.env.GOOGLE_GEMINI_BASE_URL = baseUrl
    return [
      `已切到 ${provider.name}（GOOGLE_GEMINI_BASE_URL=${baseUrl}），模型 ${model}`,
      backupPath ? `原配置已备份 → ${backupPath}` : ''
    ]
      .filter(Boolean)
      .join('；')
  }

  // Each target is switched independently: a broken ~/.gemini/settings.json must
  // not stop Codex from switching, and vice versa.
  async function switchGatewayUnsafe(input: SwitchGatewayRequest): Promise<SwitchGatewayResult> {
    const store = requireProfiles()
    const profile = await store.get(input.profileId)
    if (!profile) {
      return { message: '找不到这个网关配置', ok: false, results: [] }
    }
    // Profiles saved before LiveToken went offline can still say "livetoken".
    if (!isProviderId(profile.provider) || !isNetworkMode(profile.networkMode)) {
      return {
        message: `「${profile.name}」使用的网关（${profile.provider}）已下线，请点「编辑」改为 SolaEon 后再切换`,
        ok: false,
        results: []
      }
    }
    const targets = switchTargets.filter((target) => input.targets.includes(target))
    if (!targets.length) {
      return { message: '请至少选择一个要切换的工具', ok: false, results: [] }
    }

    const apiKey = await store.getKey(profile.id)
    const provider = await resolveForProfile(profile.provider, profile.networkMode)
    const results: SwitchTargetResult[] = []
    for (const target of targets) {
      try {
        const message =
          target === 'codex'
            ? await switchCodex(provider, profile.codexModel, apiKey)
            : await switchGemini(provider, profile.geminiModel, apiKey)
        results.push({ message, ok: true, target })
      } catch (error) {
        results.push({ message: errorMessage(error), ok: false, target })
      }
    }

    if (results.some((result) => result.ok)) {
      await store.setActive(profile.id)
    }
    return { baseUrl: provider.baseUrl, ok: results.every((result) => result.ok), results }
  }

  return {
    async listGatewayProfiles(): Promise<GatewayProfilesState> {
      const geminiInstalled = Boolean(
        await detectInstalledBinary(deps.exec, 'gemini', ['--version'])
      )
      try {
        const { profiles, activeProfileId } = await requireProfiles().list()
        return { activeProfileId, geminiInstalled, profiles }
      } catch (error) {
        return { error: errorMessage(error), geminiInstalled, profiles: [] }
      }
    },

    async saveGatewayProfile(input: SaveGatewayProfileRequest): Promise<SaveGatewayProfileResult> {
      if (input.apiKey?.trim() && !isApiKeyValueValid(input.apiKey)) {
        return { message: 'API Key 必须是以 sk- 开头，或为 64 位长度的 token。', ok: false }
      }
      try {
        return { ok: true, profile: await requireProfiles().save(input) }
      } catch (error) {
        return { message: errorMessage(error), ok: false }
      }
    },

    async deleteGatewayProfile(id: string): Promise<DeleteGatewayProfileResult> {
      try {
        await requireProfiles().remove(id)
        return { ok: true }
      } catch (error) {
        return { message: errorMessage(error), ok: false }
      }
    },

    async switchGateway(input: SwitchGatewayRequest): Promise<SwitchGatewayResult> {
      try {
        return await switchGatewayUnsafe(input)
      } catch (error) {
        return { message: errorMessage(error), ok: false, results: [] }
      }
    },

    async loadEnvironment(): Promise<DetectionItemData[]> {
      // Detection only looks; config.toml is written by the write-config task.
      const configPath = getConfigTomlPath(deps.userProfile)

      return [
        await detectSystem(),
        await detectNode(),
        await detectCodex(),
        createConfigDetectionItem({
          configPath,
          exists: await deps.fileExists(configPath)
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

    async listModels(input: {
      apiKey: string
      provider?: ProviderId
      networkMode?: 'auto' | 'internal' | 'external'
    }) {
      const providerId = input.provider ?? DEFAULT_PROVIDER
      const networkMode = input.networkMode ?? 'auto'
      let internalReachable = false
      if (providerId === 'solaeon' && networkMode === 'auto') {
        internalReachable = await probeSolaeonInternal()
      }
      const resolved = resolveProvider(providerId, networkMode, internalReachable)
      // The gateway serves both Codex (gpt-*/deepseek-*/kimi-*) and Claude
      // models on one /v1/models. The Claude ones belong to the Claude
      // installer — drop them so the Codex picker only offers Codex models.
      const models = (await fetchGatewayModels(resolved, input.apiKey)).filter(
        (model) => !model.id.startsWith('claude')
      )
      return { models }
    },

    async syncModels(input: {
      apiKey?: string
      provider?: ProviderId
      networkMode?: 'auto' | 'internal' | 'external'
    }) {
      // Refresh models-catalog.json without a full reinstall. Key comes from the
      // caller or, failing that, the OPENAI_API_KEY this process already sees
      // (the same one the persist step wrote and codex itself uses).
      const apiKey = input.apiKey?.trim() || process.env.OPENAI_API_KEY?.trim()
      if (!apiKey) {
        return {
          ok: false as const,
          count: 0,
          path: getModelCatalogPath(deps.userProfile),
          message: '未找到 API Key：请先在上方填入 Key，或完成一次安装以写入环境变量。'
        }
      }

      const providerId = input.provider ?? DEFAULT_PROVIDER
      const networkMode = input.networkMode ?? 'auto'
      let internalReachable = false
      if (providerId === 'solaeon' && networkMode === 'auto') {
        internalReachable = await probeSolaeonInternal()
      }
      const resolved = resolveProvider(providerId, networkMode, internalReachable)
      const catalogPath = getModelCatalogPath(deps.userProfile)

      // Fetch the live gateway list and rebuild the full catalog (merged with
      // EXTRA_MODELS). fetchGatewayModels returns [] on failure, so worst case
      // we still write the offline EXTRA-only catalog rather than an empty one.
      const gatewayModels = await fetchGatewayModels(resolved, apiKey)
      const catalog = buildModelCatalog(gatewayModels.map((model) => model.id))
      await deps.mkdir(path.dirname(catalogPath))
      await deps.writeFile(catalogPath, JSON.stringify(catalog, null, 2))

      return {
        ok: true as const,
        count: catalog.models.length,
        gatewayCount: gatewayModels.length,
        path: catalogPath
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

      // Resolve the provider once (probing the Solaeon LAN in auto mode) so
      // verify-gateway and write-config agree on the same base_url.
      const resolveOnce = (() => {
        let cached: Awaited<ReturnType<typeof resolveProviderForRun>> | null = null
        const resolveProviderForRun = async () => {
          const providerId = input.provider ?? DEFAULT_PROVIDER
          const networkMode = input.networkMode ?? 'auto'
          let internalReachable = false
          if (providerId === 'solaeon' && networkMode === 'auto') {
            internalReachable = await probeSolaeonInternal()
          }
          return resolveProvider(providerId, networkMode, internalReachable)
        }
        return async () => {
          if (!cached) {
            cached = await resolveProviderForRun()
          }
          return cached
        }
      })()

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
            case 'verify-gateway': {
              const resolvedProvider = await resolveOnce()
              await emitLog({
                level: 'info',
                message: `探测网关 ${resolvedProvider.name}（${resolvedProvider.baseUrl}）`,
                taskId: task,
                type: 'task-output'
              })
              const check = await checkGatewayReachable(resolvedProvider, input.apiKey)
              if (!check.ok) {
                throw new Error(
                  `网关不可达（${resolvedProvider.name}）：${check.error ?? '未知错误'}`
                )
              }
              await emitLog({
                level: 'info',
                message: `网关就绪，返回 ${check.modelCount} 个模型`,
                taskId: task,
                type: 'task-output'
              })
              break
            }
            case 'write-config': {
              const resolvedProvider = await resolveOnce()
              const catalogPath = getModelCatalogPath(deps.userProfile)

              await emitLog({
                level: 'info',
                message: `写入 ${configPath}（provider=${resolvedProvider.name}, base_url=${resolvedProvider.baseUrl}, model=${input.model ?? 'gpt-5.5'}）`,
                taskId: task,
                type: 'task-output'
              })
              const written = await writeCodexConfig(
                resolvedProvider,
                input.model,
                input.apiKey,
                'full'
              )
              if (written.backupPath) {
                await emitLog({
                  level: 'info',
                  message: `已备份原配置 → ${written.backupPath}`,
                  taskId: task,
                  type: 'task-output'
                })
              }
              await emitLog({
                level: 'info',
                message: `写入 ${catalogPath}（${written.catalogCount} 个模型：网关 ${written.gatewayCount} + 内置补充）`,
                taskId: task,
                type: 'task-output'
              })
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
