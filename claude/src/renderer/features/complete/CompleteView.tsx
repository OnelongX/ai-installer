interface CompleteViewProps {
  actionLabel?: string
  desktopApp: {
    displayName: string
    installed: boolean
    statusMessage: string
  }
  onInstallDesktopApp: () => void
  onOpenDesktopApp: () => void
  onOpenProviderSite?: () => void
  summary: {
    claudeVersion: string
    configPath: string
    keyMask: string
    status: 'ready' | 'warning'
  }
}

const providerHighlights = [
  '兼容 Anthropic Messages API，开箱接入 Claude Code / Cline / Cursor 等工具链',
  '默认已写好 claude-sonnet-4-5，并预设 ANTHROPIC_BASE_URL 指向 LiveToken',
  '国内直连稳定，按量计费，控制台余额一目了然'
]

export function CompleteView({
  actionLabel,
  desktopApp,
  onInstallDesktopApp,
  onOpenDesktopApp,
  onOpenProviderSite,
  summary
}: CompleteViewProps) {
  return (
    <section
      style={{
        minHeight: '100vh',
        padding: '36px',
        background: '#07130d',
        color: '#f0fdf4'
      }}
    >
      <div style={{ maxWidth: '920px', margin: '0 auto', display: 'grid', gap: '18px' }}>
        <p style={{ margin: 0, color: '#4ade80', textTransform: 'uppercase' }}>安装完成</p>
        <h1 style={{ margin: 0 }}>
          {summary.status === 'ready' ? 'Claude 已可使用。' : 'Claude 已完成安装，但包含警告。'}
        </h1>
        <div
          style={{
            borderRadius: '24px',
            border: '1px solid rgba(74, 222, 128, 0.24)',
            background: 'rgba(6, 23, 14, 0.84)',
            padding: '24px',
            display: 'grid',
            gap: '10px'
          }}
        >
          <p style={{ margin: 0 }}>
            版本：<span>{summary.claudeVersion}</span>
          </p>
          <p style={{ margin: 0 }}>配置文件：{summary.configPath}</p>
          <p style={{ margin: 0 }}>
            Key：<span>{summary.keyMask}</span>
          </p>
        </div>

        <div
          style={{
            borderRadius: '24px',
            border: '1px solid rgba(125, 211, 252, 0.32)',
            background:
              'linear-gradient(135deg, rgba(14, 165, 233, 0.18), rgba(37, 99, 235, 0.12))',
            padding: '24px',
            display: 'grid',
            gap: '14px'
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              gap: '12px',
              flexWrap: 'wrap'
            }}
          >
            <div>
              <p
                style={{
                  margin: 0,
                  letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                  color: '#7dd3fc',
                  fontSize: '0.72rem'
                }}
              >
                Powered by LiveToken
              </p>
              <h2 style={{ margin: '6px 0 0', fontSize: '1.2rem' }}>关于 LiveToken</h2>
            </div>
            <a
              href="https://livetoken.top/"
              style={{
                color: '#7dd3fc',
                fontSize: '0.9rem',
                textDecoration: 'none'
              }}
              onClick={(event) => {
                event.preventDefault()
                onOpenProviderSite?.()
              }}
            >
              livetoken.top ↗
            </a>
          </div>
          <p style={{ margin: 0, color: '#cbd5e1', lineHeight: 1.6 }}>
            本次安装已将默认模型提供方配置为 LiveToken。它是一个面向 Claude Code
            等开发者工具的 Anthropic 兼容网关：
          </p>
          <ul
            style={{
              margin: 0,
              padding: '0 0 0 20px',
              color: '#e2e8f0',
              lineHeight: 1.7
            }}
          >
            {providerHighlights.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '4px' }}>
            <button
              type="button"
              onClick={() => onOpenProviderSite?.()}
              style={{
                border: '1px solid rgba(125, 211, 252, 0.65)',
                borderRadius: '999px',
                padding: '12px 22px',
                background: 'rgba(14, 165, 233, 0.18)',
                color: '#e0f2fe',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              打开 LiveToken 控制台
            </button>
          </div>
        </div>

        <div
          style={{
            borderRadius: '24px',
            border: '1px solid rgba(56, 189, 248, 0.24)',
            background: 'rgba(8, 20, 35, 0.78)',
            padding: '24px',
            display: 'grid',
            gap: '12px'
          }}
        >
          <h2 style={{ margin: 0, fontSize: '1.15rem' }}>{desktopApp.displayName}</h2>
          <p style={{ margin: 0, color: '#cbd5e1' }}>{desktopApp.statusMessage}</p>
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <button
              type="button"
              onClick={desktopApp.installed ? onOpenDesktopApp : onInstallDesktopApp}
              style={{
                border: 'none',
                borderRadius: '999px',
                padding: '14px 22px',
                background: 'linear-gradient(135deg, #38bdf8, #2563eb)',
                color: '#eff6ff',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              {actionLabel ??
                (desktopApp.installed ? '打开 Claude Desktop' : '前往安装 Claude Desktop')}
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
