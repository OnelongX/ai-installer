import type { DetectionItem, DetectionStatus } from './detection-types'

export function classifyConfigState(exists: boolean): DetectionStatus {
  return exists ? 'satisfied' : 'auto-fixable'
}

interface CreateConfigDetectionItemInput {
  configPath: string
  created?: boolean
  exists: boolean
}

export function createConfigDetectionItem(
  input: CreateConfigDetectionItemInput
): DetectionItem {
  if (input.exists && input.created) {
    return {
      command: '%USERPROFILE%\\.codex\\config.toml',
      detail: `\u5df2\u81ea\u52a8\u751f\u6210 ${input.configPath}`,
      id: 'config',
      status: 'satisfied',
      title: 'Codex \u914d\u7f6e'
    }
  }

  if (input.exists) {
    return {
      command: '%USERPROFILE%\\.codex\\config.toml',
      detail: `\u5df2\u68c0\u6d4b\u5230 ${input.configPath}`,
      id: 'config',
      status: 'satisfied',
      title: 'Codex \u914d\u7f6e'
    }
  }

  return {
    command: '%USERPROFILE%\\.codex\\config.toml',
    detail: '\u672a\u68c0\u6d4b\u5230 config.toml\uff0c\u5c06\u5728\u9996\u6b21\u542f\u52a8\u65f6\u81ea\u52a8\u751f\u6210',
    id: 'config',
    status: classifyConfigState(false),
    title: 'Codex \u914d\u7f6e'
  }
}
