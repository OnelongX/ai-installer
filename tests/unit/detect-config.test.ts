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

  it('describes an auto-generated config file in Chinese', () => {
    const item = createConfigDetectionItem({
      configPath: 'C:\\Users\\Administrator\.claude\\config.toml',
      created: true,
      exists: true
    })

    expect(item.title).toBe('Claude 配置')
    expect(item.detail).toBe('已自动生成 C:\\Users\\Administrator\.claude\\config.toml')
  })
})
