import type { InstallerTaskState } from '../../shared/installer'
import { createTaskRunContext, type TaskRunContext } from './context'
import { createTaskRegistry, type ExecutableTask } from './task-registry'

export interface TaskRunResult {
  events: InstallerTaskState[]
  context: TaskRunContext
}

export class TaskRunError extends Error {
  constructor(
    message: string,
    readonly failedTaskId: string,
    readonly events: InstallerTaskState[],
    readonly context: TaskRunContext
  ) {
    super(message)
    this.name = 'TaskRunError'
  }
}

async function visitTask(
  task: ExecutableTask,
  registry: Map<string, ExecutableTask>,
  visited: Set<string>,
  result: TaskRunResult
) {
  if (visited.has(task.id)) {
    return
  }

  visited.add(task.id)

  for (const dependencyId of task.dependencies) {
    const dependency = registry.get(dependencyId)

    if (!dependency) {
      throw new Error(`Missing dependency: ${dependencyId}`)
    }

    await visitTask(dependency, registry, visited, result)
  }

  const startedAt = new Date().toISOString()
  const shouldSkip = await task.check()

  if (!shouldSkip) {
    await task.run()
  }

  const verified = shouldSkip ? true : await task.verify()

  const event: InstallerTaskState = {
    taskId: task.id,
    status: verified ? (shouldSkip ? 'skipped' : 'completed') : 'failed',
    startedAt,
    completedAt: new Date().toISOString()
  }

  result.events.push(event)
  result.context.taskStates.set(event.taskId, event)

  if (!verified) {
    throw new TaskRunError(
      `Task verification failed: ${task.id}`,
      task.id,
      result.events,
      result.context
    )
  }
}

export async function runTasks(tasks: ExecutableTask[]) {
  const registry = createTaskRegistry(tasks)
  const result: TaskRunResult = {
    context: createTaskRunContext(),
    events: []
  }
  const visited = new Set<string>()

  for (const task of tasks) {
    await visitTask(task, registry, visited, result)
  }

  return result
}
