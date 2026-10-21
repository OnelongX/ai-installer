import path from 'node:path'
import { randomUUID } from 'node:crypto'

import type { GatewayProfile, SaveGatewayProfileRequest } from '../../shared/gateway-switch'
import { isNetworkMode, isProviderId } from '../../shared/provider-config'

// Saved gateway profiles for "切换网关". Lives in the installer's userData dir.
// API keys are stored encrypted (Electron safeStorage → DPAPI on Windows) and
// only ever decrypted in the main process at switch time.

interface StoredProfile extends GatewayProfile {
  keyCipher: string
}

interface StoredProfilesFile {
  version: 1
  activeProfileId?: string
  profiles: StoredProfile[]
}

export interface GatewayProfileStoreDeps {
  filePath: string
  mkdir(path: string): Promise<void>
  readFile(path: string): Promise<string | null>
  writeFile(path: string, value: string): Promise<void>
  /** plain → opaque string (base64 cipher) */
  encrypt(plain: string): string
  decrypt(cipher: string): string
  newId?: () => string
  now?: () => Date
}

export type GatewayProfileStore = ReturnType<typeof createGatewayProfileStore>

export function maskKey(apiKey: string) {
  const trimmed = apiKey.trim()

  if (trimmed.length < 6) {
    return '***'
  }

  return `${trimmed.slice(0, 2)}***${trimmed.slice(-4)}`
}

const toPublic = ({ keyCipher: _cipher, ...profile }: StoredProfile): GatewayProfile => profile

export function createGatewayProfileStore(deps: GatewayProfileStoreDeps) {
  const newId = deps.newId ?? randomUUID
  const now = deps.now ?? (() => new Date())

  async function load(): Promise<StoredProfilesFile> {
    const raw = await deps.readFile(deps.filePath)
    if (!raw?.trim()) {
      return { version: 1, profiles: [] }
    }
    // A corrupt file is an error, not an empty list: saving over it would
    // silently drop every profile the user had.
    const parsed = JSON.parse(raw) as Partial<StoredProfilesFile>
    if (!Array.isArray(parsed.profiles)) {
      throw new Error(`网关配置文件格式不正确：${deps.filePath}`)
    }
    return { version: 1, activeProfileId: parsed.activeProfileId, profiles: parsed.profiles }
  }

  async function persist(file: StoredProfilesFile) {
    await deps.mkdir(path.dirname(deps.filePath))
    await deps.writeFile(deps.filePath, JSON.stringify(file, null, 2))
  }

  return {
    async list() {
      const file = await load()
      return { activeProfileId: file.activeProfileId, profiles: file.profiles.map(toPublic) }
    },

    async get(id: string) {
      const found = (await load()).profiles.find((profile) => profile.id === id)
      return found ? toPublic(found) : undefined
    },

    async getKey(id: string) {
      const found = (await load()).profiles.find((profile) => profile.id === id)
      if (!found) {
        throw new Error('找不到这个网关配置')
      }
      return deps.decrypt(found.keyCipher)
    },

    async save(input: SaveGatewayProfileRequest): Promise<GatewayProfile> {
      const name = input.name.trim()
      if (!name) {
        throw new Error('请填写配置名称')
      }
      if (!isProviderId(input.provider) || !isNetworkMode(input.networkMode)) {
        throw new Error('网关或网络模式无效')
      }
      if (!input.codexModel.trim() || !input.geminiModel.trim()) {
        throw new Error('请填写 Codex 和 Gemini 的默认模型')
      }

      const file = await load()
      const existing = input.id ? file.profiles.find((profile) => profile.id === input.id) : undefined
      if (input.id && !existing) {
        throw new Error('找不到要编辑的网关配置')
      }
      const apiKey = input.apiKey?.trim()
      if (!existing && !apiKey) {
        throw new Error('新建配置需要填写 API Key')
      }

      const profile: StoredProfile = {
        id: existing?.id ?? newId(),
        name,
        provider: input.provider,
        networkMode: input.networkMode,
        codexModel: input.codexModel.trim(),
        geminiModel: input.geminiModel.trim(),
        keyMask: apiKey ? maskKey(apiKey) : existing!.keyMask,
        keyCipher: apiKey ? deps.encrypt(apiKey) : existing!.keyCipher,
        updatedAt: now().toISOString()
      }

      file.profiles = existing
        ? file.profiles.map((item) => (item.id === profile.id ? profile : item))
        : [...file.profiles, profile]
      await persist(file)
      return toPublic(profile)
    },

    async remove(id: string) {
      const file = await load()
      file.profiles = file.profiles.filter((profile) => profile.id !== id)
      if (file.activeProfileId === id) {
        file.activeProfileId = undefined
      }
      await persist(file)
    },

    async setActive(id: string) {
      const file = await load()
      file.activeProfileId = id
      await persist(file)
    }
  }
}
