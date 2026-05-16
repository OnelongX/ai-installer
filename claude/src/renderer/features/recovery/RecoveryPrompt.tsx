import {
  formatInstallerTaskList,
  getInstallerTaskLabel
} from '../../../shared/task-labels'

interface RecoveryPromptProps {
  completedTasks: string[]
  failedTaskId?: string
  lastFailureAt?: string
  onDismiss(): void
  onResume(): void
  pendingTasks: string[]
  recentLogs: string[]
  summary?: string
}

export function RecoveryPrompt({
  completedTasks,
  failedTaskId,
  lastFailureAt,
  onDismiss,
  onResume,
  pendingTasks,
  recentLogs,
  summary
}: RecoveryPromptProps) {
  const formattedFailureTime = lastFailureAt
    ? new Date(lastFailureAt).toLocaleString()
    : undefined

  return (
    <section
      style={{
        minHeight: '100vh',
        padding: '36px',
        background: '#08111f',
        color: '#eff6ff',
        display: 'grid',
        placeItems: 'center'
      }}
    >
      <div
        style={{
          width: 'min(760px, 100%)',
          borderRadius: '28px',
          border: '1px solid rgba(125, 211, 252, 0.18)',
          background: 'linear-gradient(180deg, rgba(8, 15, 29, 0.96), rgba(15, 23, 42, 0.92))',
          padding: '32px',
          display: 'grid',
          gap: '20px'
        }}
      >
        <header style={{ display: 'grid', gap: '8px' }}>
          <p style={{ margin: 0, color: '#7dd3fc', textTransform: 'uppercase' }}>安装恢复</p>
          <h1 style={{ margin: 0 }}>检测到未完成的 Claude 安装。</h1>
          <p style={{ margin: 0, color: 'rgba(226, 232, 240, 0.78)', lineHeight: 1.6 }}>
            {summary ?? '上一次安装会话在所有任务完成前中断了。'}
          </p>
        </header>

        <div
          style={{
            borderRadius: '22px',
            border: '1px solid rgba(148, 163, 184, 0.18)',
            background: 'rgba(15, 23, 42, 0.82)',
            padding: '20px',
            display: 'grid',
            gap: '10px'
          }}
        >
          {failedTaskId ? (
            <p style={{ margin: 0 }}>
              上次失败任务：<strong>{getInstallerTaskLabel(failedTaskId)}</strong>
            </p>
          ) : null}
          {formattedFailureTime ? (
            <p style={{ margin: 0 }}>
              上次失败时间：<strong>{formattedFailureTime}</strong>
            </p>
          ) : null}
          {completedTasks.length > 0 ? (
            <p style={{ margin: 0 }}>
              已完成任务：<strong>{formatInstallerTaskList(completedTasks)}</strong>
            </p>
          ) : null}
          <p style={{ margin: 0 }}>
            待执行任务：<strong>{formatInstallerTaskList(pendingTasks)}</strong>
          </p>
        </div>

        {recentLogs.length > 0 ? (
          <div
            style={{
              borderRadius: '22px',
              border: '1px solid rgba(251, 191, 36, 0.16)',
              background: 'rgba(17, 24, 39, 0.72)',
              padding: '20px',
              display: 'grid',
              gap: '10px'
            }}
          >
            <p style={{ margin: 0, color: '#fde68a', textTransform: 'uppercase' }}>诊断预览</p>
            {recentLogs.map((entry) => (
              <code
                key={entry}
                style={{
                  display: 'block',
                  borderRadius: '14px',
                  background: 'rgba(2, 6, 23, 0.78)',
                  padding: '12px 14px',
                  color: '#fef3c7'
                }}
              >
                {entry}
              </code>
            ))}
          </div>
        ) : null}

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={onResume}
            style={{
              borderRadius: '999px',
              border: 'none',
              padding: '14px 22px',
              background: 'linear-gradient(135deg, #38bdf8, #2563eb)',
              color: '#eff6ff',
              fontWeight: 700
            }}
          >
            继续上次安装
          </button>
          <button
            type="button"
            onClick={onDismiss}
            style={{
              borderRadius: '999px',
              border: '1px solid rgba(148, 163, 184, 0.28)',
              padding: '14px 22px',
              background: 'rgba(15, 23, 42, 0.82)',
              color: '#eff6ff'
            }}
          >
            重新开始
          </button>
        </div>
      </div>
    </section>
  )
}
