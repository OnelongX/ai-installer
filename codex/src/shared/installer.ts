import { errorCategories, type InstallerError } from './errors'

export { errorCategories, type InstallerError }

export const taskStatusValues = [
  'pending',
  'running',
  'completed',
  'failed',
  'skipped'
] as const

export type TaskStatus = (typeof taskStatusValues)[number]

export type ApiKeyMode = 'existing' | 'session' | 'user-env'

export interface InstallerTaskDefinition {
  id: string
  title: string
  dependencies: string[]
}

export interface InstallerTaskState {
  taskId: string
  status: TaskStatus
  startedAt?: string
  completedAt?: string
  error?: InstallerError
}

export interface DiagnosticLogEvent {
  taskId: string
  level: 'info' | 'warn' | 'error'
  message: string
  timestamp: string
}
