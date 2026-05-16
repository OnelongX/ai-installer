export type DetectionStatus =
  | 'auto-fixable'
  | 'manual-action'
  | 'satisfied'
  | 'skipped'

export interface DetectionItem {
  command?: string
  id: string
  observedOutput?: string
  title: string
  detail: string
  status: DetectionStatus
}
