import { describe, expect, it } from 'vitest'
import { errorCategories, taskStatusValues } from '../../src/shared/installer'

describe('installer domain models', () => {
  it('defines supported task statuses', () => {
    expect(taskStatusValues).toContain('failed')
  })

  it('defines structured error categories', () => {
    expect(errorCategories).toContain('network')
  })
})
