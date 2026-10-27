import { describe, expect, it } from 'vitest'
import {
  classifyConfigState,
  createConfigDetectionItem
} from '../../src/main/installer/tasks/detect-config'

describe('config detection', () => {
  it('marks an existing config file as satisfied', () => {
    expect(classifyConfigState(true)).toBe('satisfied')
  })

  it('marks a missing config file as auto-fixable', () => {
    expect(classifyConfigState(false)).toBe('auto-fixable')
  })

  it('describes found and missing config files in Chinese', () => {
    const configPath = 'C:\Users\Administrator\.codex\config.toml'
    expect(createConfigDetectionItem({ configPath, exists: true })).toMatchObject({
      title: 'Codex 配置',
      status: 'satisfied',
      detail: `已检测到 ${configPath}`
    })
    expect(createConfigDetectionItem({ configPath, exists: false })).toMatchObject({
      status: 'auto-fixable',
      detail: '未检测到 config.toml，将在安装时写入'
    })
  })
})
