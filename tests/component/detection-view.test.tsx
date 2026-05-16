import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { DetectionView } from '../../src/renderer/features/detection/DetectionView'

describe('detection view', () => {
  it('shows Chinese labels without mojibake', () => {
    render(
      <DetectionView
        items={[
          {
            detail: '\u5df2\u81ea\u52a8\u751f\u6210 C:\\Users\\Administrator\.claude\\config.toml',
            id: 'config',
            status: 'satisfied',
            title: 'Claude \u914d\u7f6e'
          }
        ]}
      />
    )

    expect(screen.getByText('\u73af\u5883\u68c0\u6d4b')).toBeInTheDocument()
    expect(screen.getByText('\u5df2\u6ee1\u8db3')).toBeInTheDocument()
    expect(screen.getByText('Claude \u914d\u7f6e')).toBeInTheDocument()
    expect(
      screen.getByText('\u5df2\u81ea\u52a8\u751f\u6210 C:\\Users\\Administrator\.claude\\config.toml')
    ).toBeInTheDocument()
  })

  it('shows the command and observed output for a check', () => {
    render(
      <DetectionView
        items={[
          {
            command: 'node -v',
            detail: '\u5df2\u68c0\u6d4b\u5230 v24.14.0',
            id: 'node',
            observedOutput: 'v24.14.0',
            status: 'satisfied',
            title: 'Node.js'
          }
        ]}
      />
    )

    expect(screen.getByText('node -v')).toBeInTheDocument()
    expect(screen.getByText('v24.14.0')).toBeInTheDocument()
  })
})
