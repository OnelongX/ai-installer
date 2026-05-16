import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ExecutionView } from '../../src/renderer/features/execution/ExecutionView'

describe('execution view', () => {
  it('shows retry and resume controls after a failed task', () => {
    const onRetryCurrentStep = vi.fn()
    const onResume = vi.fn()
    const onOpenRepairGuide = vi.fn()

    render(
      <ExecutionView
        onOpenRepairGuide={onOpenRepairGuide}
        onResume={onResume}
        onRetryCurrentStep={onRetryCurrentStep}
        state={{
          currentTask: 'install-claude',
          failedTask: 'install-claude',
          issueMessage: '下载失败',
          issueUserAction: '检查网络连接后重试。',
          logs: ['npm i -g @anthropic-ai/claude-code'],
          progressLabel: '正在安装 Claude Code CLI'
        }}
      />
    )

    expect(screen.getByText('下载失败')).toBeInTheDocument()
    expect(screen.getByText('当前任务：安装 Claude Code CLI')).toBeInTheDocument()
    expect(screen.getByText('重试当前步骤')).toBeInTheDocument()
    expect(screen.getByText('继续安装')).toBeInTheDocument()
    expect(screen.getByText('查看修复指引')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '重试当前步骤' }))
    fireEvent.click(screen.getByRole('button', { name: '继续安装' }))
    fireEvent.click(screen.getByRole('button', { name: '查看修复指引' }))

    expect(onRetryCurrentStep).toHaveBeenCalled()
    expect(onResume).toHaveBeenCalled()
    expect(onOpenRepairGuide).toHaveBeenCalled()
  })
})
