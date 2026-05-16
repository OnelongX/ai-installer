import { describe, expect, it } from 'vitest'
import { runTasks, TaskRunError } from '../../src/main/installer/task-runner'

describe('task runner', () => {
  it('runs tasks in dependency order', async () => {
    const result = await runTasks([
      {
        id: 'a',
        dependencies: [],
        check: async () => false,
        run: async () => {},
        verify: async () => true
      },
      {
        id: 'b',
        dependencies: ['a'],
        check: async () => false,
        run: async () => {},
        verify: async () => true
      }
    ])

    expect(result.events.map((event) => event.taskId)).toEqual(['a', 'b'])
    expect(result.context.taskStates.get('a')?.status).toBe('completed')
  })

  it('returns structured failure data when verification fails', async () => {
    await expect(
      runTasks([
        {
          id: 'broken',
          dependencies: [],
          check: async () => false,
          run: async () => {},
          verify: async () => false
        }
      ])
    ).rejects.toMatchObject<TaskRunError>({
      failedTaskId: 'broken',
      events: [{ taskId: 'broken', status: 'failed' }]
    })
  })
})
