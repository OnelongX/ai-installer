import type { InstallerTaskState } from '../../shared/installer'

export interface TaskRunContext {
  taskStates: Map<string, InstallerTaskState>
}

export function createTaskRunContext(): TaskRunContext {
  return {
    taskStates: new Map()
  }
}
