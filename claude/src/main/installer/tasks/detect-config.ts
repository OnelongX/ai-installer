import type { DetectionItem, DetectionStatus } from './detection-types'

export function classifyConfigState(exists: boolean): DetectionStatus {
  return exists ? 'satisfied' : 'auto-fixable'
}

interface CreateConfigDetectionItemInput {
  configPath: string
  created?: boolean
  exists: boolean
}

const CONFIG_HINT = '%USERPROFILE%\\.claude\\settings.json'

export function createConfigDetectionItem(
  input: CreateConfigDetectionItemInput
): DetectionItem {
  if (input.exists && input.created) {
    return {
      command: CONFIG_HINT,
      detail: `已自动生成 ${input.configPath}`,
      id: 'config',
      status: 'satisfied',
      title: 'Claude 配置'
    }
  }

  if (input.exists) {
    return {
      command: CONFIG_HINT,
      detail: `已检测到 ${input.configPath}`,
      id: 'config',
      status: 'satisfied',
      title: 'Claude 配置'
    }
  }

  return {
    command: CONFIG_HINT,
    detail: '未检测到 settings.json，将在首次启动时自动生成',
    id: 'config',
    status: classifyConfigState(false),
    title: 'Claude 配置'
  }
}
