import { getPlatformAdapter } from '../../platform'
import type { DetectionItem } from './detection-types'

export async function detectSystem(): Promise<DetectionItem> {
  const adapter = getPlatformAdapter()

  return {
    detail: `${adapter.displayName}, Shell: ${adapter.shell}`,
    id: 'system',
    status: 'satisfied',
    title: '\u64cd\u4f5c\u7cfb\u7edf'
  }
}
