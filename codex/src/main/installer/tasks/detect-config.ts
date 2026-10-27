import type { DetectionItem, DetectionStatus } from './detection-types'

export function classifyConfigState(exists: boolean): DetectionStatus {
  return exists ? 'satisfied' : 'auto-fixable'
}

interface CreateConfigDetectionItemInput {
  configPath: string
  exists: boolean
}

export function createConfigDetectionItem(
  input: CreateConfigDetectionItemInput
): DetectionItem {
  if (input.exists) {
    return {
      command: '%USERPROFILE%\\.codex\\config.toml',
      detail: `已检测到 ${input.configPath}`,
      id: 'config',
      status: 'satisfied',
      title: 'Codex 配置'
    }
  }

  return {
    command: '%USERPROFILE%\\.codex\\config.toml',
    detail: '未检测到 config.toml，将在安装时写入',
    id: 'config',
    status: classifyConfigState(false),
    title: 'Codex 配置'
  }
}
