interface RepairViewProps {
  diagnosticsReport?: string
  issue: {
    category: string
    likelyCause?: string
    message: string
    userAction?: string
  }
  onExportDiagnostics?(): void
  onResume?(): void
  onRetryCurrentStep?(): void
  pendingAction?: 'export' | 'resume' | 'retry' | null
}

export function RepairView({
  diagnosticsReport,
  issue,
  onExportDiagnostics,
  onResume,
  onRetryCurrentStep,
  pendingAction
}: RepairViewProps) {
  return (
    <section
      style={{
        minHeight: '100vh',
        padding: '36px',
        background: '#120b0f',
        color: '#fff7ed'
      }}
    >
      <div style={{ maxWidth: '920px', margin: '0 auto', display: 'grid', gap: '18px' }}>
        <p style={{ margin: 0, color: '#fb923c', textTransform: 'uppercase' }}>修复建议</p>
        <h1 style={{ margin: 0 }}>{issue.message}</h1>
        <div
          style={{
            borderRadius: '24px',
            border: '1px solid rgba(251, 146, 60, 0.24)',
            background: 'rgba(38, 14, 21, 0.84)',
            padding: '24px',
            display: 'grid',
            gap: '12px'
          }}
        >
          <strong>问题分类：{issue.category}</strong>
          {issue.likelyCause ? <p style={{ margin: 0 }}>{issue.likelyCause}</p> : null}
          {issue.userAction ? <p style={{ margin: 0 }}>{issue.userAction}</p> : null}
        </div>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={onRetryCurrentStep}
            disabled={pendingAction === 'retry'}
            style={{
              borderRadius: '999px',
              border: 'none',
              padding: '12px 18px',
              background: '#ea580c',
              color: '#fff7ed',
              opacity: pendingAction === 'retry' ? 0.72 : 1
            }}
          >
            {pendingAction === 'retry' ? '正在重试...' : '重试失败步骤'}
          </button>
          <button
            type="button"
            onClick={onResume}
            disabled={pendingAction === 'resume'}
            style={{
              borderRadius: '999px',
              border: '1px solid rgba(251, 146, 60, 0.24)',
              padding: '12px 18px',
              background: 'rgba(38, 14, 21, 0.84)',
              color: '#fff7ed',
              opacity: pendingAction === 'resume' ? 0.72 : 1
            }}
          >
            {pendingAction === 'resume' ? '正在继续...' : '继续安装'}
          </button>
          <button
            type="button"
            onClick={onExportDiagnostics}
            disabled={pendingAction === 'export'}
            style={{
              borderRadius: '999px',
              border: '1px solid rgba(251, 191, 36, 0.28)',
              padding: '12px 18px',
              background: 'rgba(68, 26, 3, 0.9)',
              color: '#fde68a',
              opacity: pendingAction === 'export' ? 0.72 : 1
            }}
          >
            {pendingAction === 'export' ? '正在导出...' : '导出诊断报告'}
          </button>
        </div>
        {diagnosticsReport ? (
          <pre
            style={{
              margin: 0,
              borderRadius: '24px',
              border: '1px solid rgba(251, 191, 36, 0.18)',
              background: 'rgba(17, 24, 39, 0.72)',
              color: '#fde68a',
              padding: '20px',
              overflowX: 'auto',
              whiteSpace: 'pre-wrap'
            }}
          >
            {diagnosticsReport}
          </pre>
        ) : null}
      </div>
    </section>
  )
}
