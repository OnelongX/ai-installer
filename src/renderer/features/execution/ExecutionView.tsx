import { getInstallerTaskLabel } from '../../../shared/task-labels'

interface ExecutionViewProps {
  onOpenRepairGuide?(): void
  onResume?(): void
  onRetryCurrentStep?(): void
  pendingAction?: 'resume' | 'retry' | null
  state: {
    currentTask: string
    failedTask?: string
    issueMessage?: string
    issueUserAction?: string
    logs: string[]
    progressLabel: string
  }
}

export function ExecutionView({
  onOpenRepairGuide,
  onResume,
  onRetryCurrentStep,
  pendingAction,
  state
}: ExecutionViewProps) {
  const isFailed = Boolean(state.failedTask)
  const currentTaskLabel = getInstallerTaskLabel(state.currentTask)

  return (
    <section
      style={{
        minHeight: '100vh',
        padding: '36px',
        background: '#06101a',
        color: '#eff6ff'
      }}
    >
      <div style={{ maxWidth: '960px', margin: '0 auto', display: 'grid', gap: '20px' }}>
        <header style={{ display: 'grid', gap: '8px' }}>
          <p style={{ margin: 0, color: '#7dd3fc', textTransform: 'uppercase' }}>安装执行</p>
          <h1 style={{ margin: 0 }}>{state.progressLabel}</h1>
          <p style={{ margin: 0, color: 'rgba(226, 232, 240, 0.72)' }}>
            当前任务：{currentTaskLabel}
          </p>
        </header>

        <div
          style={{
            borderRadius: '24px',
            border: '1px solid rgba(148, 163, 184, 0.18)',
            background: 'rgba(15, 23, 42, 0.84)',
            padding: '24px',
            display: 'grid',
            gap: '12px'
          }}
        >
          {state.logs.map((entry) => (
            <code
              key={entry}
              style={{
                display: 'block',
                borderRadius: '14px',
                background: 'rgba(2, 6, 23, 0.78)',
                padding: '12px 14px'
              }}
            >
              {entry}
            </code>
          ))}
        </div>

        {isFailed ? (
          <div
            style={{
              borderRadius: '20px',
              border: '1px solid rgba(248, 113, 113, 0.24)',
              background: 'rgba(69, 10, 10, 0.5)',
              padding: '18px',
              display: 'grid',
              gap: '8px'
            }}
          >
            {state.issueMessage ? <strong>{state.issueMessage}</strong> : null}
            {state.issueUserAction ? (
              <p style={{ margin: 0, color: 'rgba(254, 226, 226, 0.84)' }}>{state.issueUserAction}</p>
            ) : null}
          </div>
        ) : null}

        {isFailed ? (
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={onRetryCurrentStep}
              disabled={pendingAction === 'retry'}
              style={{
                borderRadius: '999px',
                border: 'none',
                padding: '12px 18px',
                background: '#2563eb',
                color: '#eff6ff',
                opacity: pendingAction === 'retry' ? 0.72 : 1
              }}
            >
              {pendingAction === 'retry' ? '正在重试...' : '重试当前步骤'}
            </button>
            <button
              type="button"
              onClick={onResume}
              disabled={pendingAction === 'resume'}
              style={{
                borderRadius: '999px',
                border: '1px solid rgba(148, 163, 184, 0.24)',
                padding: '12px 18px',
                background: 'rgba(15, 23, 42, 0.82)',
                color: '#eff6ff',
                opacity: pendingAction === 'resume' ? 0.72 : 1
              }}
            >
              {pendingAction === 'resume' ? '正在继续...' : '继续安装'}
            </button>
            <button
              type="button"
              onClick={onOpenRepairGuide}
              style={{
                borderRadius: '999px',
                border: '1px solid rgba(125, 211, 252, 0.24)',
                padding: '12px 18px',
                background: 'rgba(8, 47, 73, 0.82)',
                color: '#bae6fd'
              }}
            >
              查看修复指引
            </button>
          </div>
        ) : null}
      </div>
    </section>
  )
}
