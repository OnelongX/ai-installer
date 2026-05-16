import type { DetectionItemData } from '../../../shared/ipc'

export type DetectionItem = DetectionItemData

interface DetectionViewProps {
  items: DetectionItem[]
  onContinue?: () => void
}

const statusLabelMap: Record<DetectionItem['status'], string> = {
  'auto-fixable': '\u53ef\u81ea\u52a8\u4fee\u590d',
  'manual-action': '\u9700\u624b\u52a8\u5904\u7406',
  satisfied: '\u5df2\u6ee1\u8db3',
  skipped: '\u5df2\u8df3\u8fc7'
}

const statusColorMap: Record<DetectionItem['status'], string> = {
  'auto-fixable': '#f59e0b',
  'manual-action': '#ef4444',
  satisfied: '#22c55e',
  skipped: '#94a3b8'
}

export function DetectionView({ items, onContinue }: DetectionViewProps) {
  return (
    <section
      style={{
        minHeight: '100vh',
        background:
          'radial-gradient(circle at top, rgba(28,64,108,0.32), transparent 34%), #07111f',
        color: '#eff6ff',
        padding: '32px'
      }}
    >
      <div style={{ maxWidth: '980px', margin: '0 auto' }}>
        <p
          style={{
            margin: 0,
            color: '#67e8f9',
            fontSize: '0.95rem',
            fontWeight: 700,
            letterSpacing: '0.08em'
          }}
        >
          {'\u73af\u5883\u68c0\u6d4b'}
        </p>
        <h1 style={{ margin: '12px 0 24px', fontSize: '2.2rem', lineHeight: 1.2 }}>
          {'\u5728\u5b89\u88c5 Codex \u524d\u68c0\u67e5\u5f53\u524d\u8bbe\u5907\u73af\u5883\u3002'}
        </h1>

        <div style={{ display: 'grid', gap: '18px' }}>
          {items.map((item) => (
            <article
              key={item.id}
              style={{
                border: '1px solid rgba(148, 163, 184, 0.22)',
                borderRadius: '24px',
                background: 'rgba(15, 23, 42, 0.92)',
                padding: '28px 30px'
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: '16px'
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <h2 style={{ margin: 0, fontSize: '1.15rem' }}>{item.title}</h2>
                  <p style={{ margin: '14px 0 0', fontSize: '1rem', color: '#dbeafe' }}>
                    {item.detail}
                  </p>
                  {item.command ? (
                    <p
                      style={{
                        margin: '14px 0 0',
                        color: '#93c5fd',
                        fontFamily: 'Consolas, "Courier New", monospace',
                        fontSize: '0.92rem',
                        wordBreak: 'break-all'
                      }}
                    >
                      {item.command}
                    </p>
                  ) : null}
                  {item.observedOutput ? (
                    <pre
                      style={{
                        margin: '10px 0 0',
                        padding: '12px 14px',
                        borderRadius: '14px',
                        background: 'rgba(2, 6, 23, 0.55)',
                        color: '#e2e8f0',
                        fontFamily: 'Consolas, "Courier New", monospace',
                        fontSize: '0.9rem',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word'
                      }}
                    >
                      {item.observedOutput}
                    </pre>
                  ) : null}
                </div>

                <span
                  style={{
                    flexShrink: 0,
                    borderRadius: '999px',
                    padding: '10px 16px',
                    background: `${statusColorMap[item.status]}22`,
                    color: statusColorMap[item.status],
                    fontWeight: 700
                  }}
                >
                  {statusLabelMap[item.status]}
                </span>
              </div>
            </article>
          ))}
        </div>

        {onContinue ? (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '28px' }}>
            <button
              onClick={onContinue}
              style={{
                border: 'none',
                borderRadius: '999px',
                padding: '16px 28px',
                background: 'linear-gradient(135deg, #38bdf8, #2563eb)',
                color: '#eff6ff',
                fontSize: '1rem',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              {'\u7ee7\u7eed\u5230\u5b89\u88c5\u8ba1\u5212'}
            </button>
          </div>
        ) : null}
      </div>
    </section>
  )
}
