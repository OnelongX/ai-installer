import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PlanView } from '../../src/renderer/features/plan/PlanView'

describe('plan view', () => {
  it('renders the planned task list', () => {
    render(
      <PlanView
        plan={{
          summary: '在这台电脑上安装 Claude',
          tasks: ['install-claude', 'write-config']
        }}
      />
    )

    expect(screen.getByText('安装计划')).toBeInTheDocument()
    expect(screen.getByText('安装 Claude Code CLI')).toBeInTheDocument()
    expect(screen.getByText('写入 Claude 配置')).toBeInTheDocument()
  })
})
