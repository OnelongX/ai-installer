export interface ExecutableTask {
  id: string
  dependencies: string[]
  check(): Promise<boolean>
  run(): Promise<void>
  verify(): Promise<boolean>
}

export function createTaskRegistry(tasks: ExecutableTask[]) {
  return new Map(tasks.map((task) => [task.id, task]))
}
