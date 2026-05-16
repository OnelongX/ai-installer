import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { RepairView } from '../../src/renderer/features/repair/RepairView'

describe('repair view', () => {
  it('shows structured recovery guidance', () => {
    render(
      <RepairView
        issue={{
          category: 'network',
          likelyCause: 'The npm registry could not be reached.',
          message: 'Download failed',
          userAction: 'Retry after checking connectivity.'
        }}
      />
    )

    expect(screen.getByText('Download failed')).toBeInTheDocument()
    expect(screen.getByText('Retry after checking connectivity.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '重试失败步骤' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '继续安装' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '导出诊断报告' })).toBeInTheDocument()
  })
})
