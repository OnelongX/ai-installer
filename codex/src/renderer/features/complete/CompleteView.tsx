interface CompleteViewProps {
  actionLabel?: string
  desktopApp: {
    displayName: string
    installed: boolean
    statusMessage: string
  }
  onInstallDesktopApp: () => void
  onOpenDesktopApp: () => void
  /** open 切换网关 (switch Codex / Gemini CLI between saved gateways) */
  onOpenGatewaySwitch?: () => void
  summary: {
    codexVersion: string
    configPath: string
    keyMask: string
    status: 'ready' | 'warning'
  }
}


export function CompleteView({
  actionLabel,
  desktopApp,
  onInstallDesktopApp,
  onOpenDesktopApp,
  onOpenGatewaySwitch,
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
          {summary.status === 'ready' ? 'Codex 已可使用。' : 'Codex 已完成安装，但包含警告。'}
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
            版本：<span>{summary.codexVersion}</span>
          </p>
          <p style={{ margin: 0 }}>配置文件：{summary.configPath}</p>
          <p style={{ margin: 0 }}>
            Key：<span>{summary.keyMask}</span>
          </p>
          {onOpenGatewaySwitch ? (
            <div>
              <button
                type="button"
                onClick={onOpenGatewaySwitch}
                style={{
                  marginTop: '6px',
                  border: '1px solid rgba(74, 222, 128, 0.5)',
                  borderRadius: '999px',
                  padding: '8px 18px',
                  background: 'transparent',
                  color: '#bbf7d0',
                  cursor: 'pointer'
                }}
              >
                ⇄ 切换网关（Codex / Gemini CLI）
              </button>
            </div>
          ) : null}
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
          <p
            role="note"
            style={{
              margin: 0,
              borderRadius: '14px',
              border: '1px solid rgba(250, 204, 21, 0.35)',
              background: 'rgba(250, 204, 21, 0.08)',
              padding: '12px 14px',
              color: '#fde68a',
              lineHeight: 1.6
            }}
          >
            提示：Codex 桌面版的「Work 模式」需要登录 ChatGPT 官方账号，使用 API Key
            时会提示 “Work browser access requires an authenticated account” 并拦截发送。
            请在新建对话的输入框处切换到代码 / 项目模式再使用。
          </p>
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
                (desktopApp.installed ? '打开 Codex 桌面版' : '前往安装 Codex 桌面版')}
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
