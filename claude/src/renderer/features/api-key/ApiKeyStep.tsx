import { useState, type CSSProperties } from 'react'

import {
  canContinueFromApiKeyState,
  toInstallerApiKeyMode,
  type ApiKeySelectionMode,
  type ApiKeyViewState
} from './api-key-state'

interface ApiKeyStepProps {
  existingKeyMask?: string
  canReuseExistingKey?: boolean
  onContinue?: (state: {
    apiKeyMode: 'existing' | 'user-env'
    keyValue: string
  }) => void
  onOpenProviderSite?: () => void
}

const panelStyle = {
  minHeight: '100vh',
  display: 'grid',
  placeItems: 'center',
  background: 'radial-gradient(circle at top, rgba(48, 120, 255, 0.14), transparent 40%), #09111f',
  color: '#f3f7ff',
  padding: '32px'
} satisfies CSSProperties

const cardStyle = {
  width: 'min(720px, 100%)',
  borderRadius: '28px',
  border: '1px solid rgba(148, 163, 184, 0.24)',
  background: 'linear-gradient(180deg, rgba(8, 15, 29, 0.94), rgba(15, 23, 42, 0.9))',
  boxShadow: '0 32px 80px rgba(3, 7, 18, 0.45)',
  overflow: 'hidden'
} satisfies CSSProperties

const sectionStyle = {
  padding: '28px 32px'
} satisfies CSSProperties

const optionStyle = (active: boolean) =>
  ({
    borderRadius: '20px',
    border: active
      ? '1px solid rgba(125, 211, 252, 0.7)'
      : '1px solid rgba(148, 163, 184, 0.2)',
    background: active ? 'rgba(14, 165, 233, 0.14)' : 'rgba(15, 23, 42, 0.65)',
    padding: '18px',
    cursor: 'pointer'
  }) satisfies CSSProperties

export function ApiKeyStep({
  existingKeyMask,
  canReuseExistingKey = false,
  onContinue,
  onOpenProviderSite
}: ApiKeyStepProps) {
  const [mode, setMode] = useState<ApiKeySelectionMode>(null)
  const [showValue, setShowValue] = useState(false)
  const [value, setValue] = useState('')

  const state: ApiKeyViewState = {
    existingKeyMask,
    mode,
    value
  }

  return (
    <section style={panelStyle}>
      <div style={cardStyle}>
        <div
          style={{
            ...sectionStyle,
            borderBottom: '1px solid rgba(148, 163, 184, 0.16)'
          }}
        >
          <p
            style={{
              margin: 0,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              color: '#7dd3fc',
              fontSize: '0.75rem'
            }}
          >
            安装访问凭证
          </p>
          <h1
            style={{
              margin: '10px 0 8px',
              fontSize: '2.3rem',
              lineHeight: 1.05
            }}
          >
            在执行任何安装前，先确认 API Key。
          </h1>
          <p
            style={{
              margin: 0,
              color: 'rgba(226, 232, 240, 0.82)',
              maxWidth: '56ch',
              lineHeight: 1.6
            }}
          >
            安装器不会静默复用凭证。请选择继续使用已检测到的 Key，或为这台电脑输入一个新的 Key。
          </p>
        </div>

        <div style={{ ...sectionStyle, display: 'grid', gap: '16px' }}>
          {canReuseExistingKey && existingKeyMask ? (
            <button
              type="button"
              onClick={() => setMode('existing')}
              style={optionStyle(mode === 'existing')}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: '12px',
                  alignItems: 'center'
                }}
              >
                <strong>继续使用已检测到的 Key</strong>
                <span style={{ color: '#7dd3fc' }}>{existingKeyMask}</span>
              </div>
              <p style={{ margin: '8px 0 0', color: 'rgba(226, 232, 240, 0.72)' }}>
                保留现有环境变量，并继续执行验证。
              </p>
            </button>
          ) : null}

          <button
            type="button"
            onClick={() => setMode('new')}
            style={optionStyle(mode === 'new')}
          >
            <strong>输入新的 Key</strong>
            <p style={{ margin: '8px 0 0', color: 'rgba(226, 232, 240, 0.72)' }}>
              为本次安装流程使用另一个 Key，并在继续前完成校验。
            </p>
          </button>

          <label
            style={{
              display: 'grid',
              gap: '10px',
              color: 'rgba(226, 232, 240, 0.9)'
            }}
          >
            <span>API Key</span>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr auto',
                gap: '12px'
              }}
            >
              <input
                aria-label="API Key"
                type={showValue ? 'text' : 'password'}
                value={value}
                onChange={(event) => {
                  setMode('new')
                  setValue(event.target.value)
                }}
                placeholder="sk-..."
                style={{
                  width: '100%',
                  borderRadius: '16px',
                  border: '1px solid rgba(148, 163, 184, 0.28)',
                  background: 'rgba(2, 6, 23, 0.66)',
                  color: '#f8fafc',
                  padding: '14px 16px'
                }}
              />
              <button
                type="button"
                onClick={() => setShowValue((current) => !current)}
                style={{
                  borderRadius: '16px',
                  border: '1px solid rgba(148, 163, 184, 0.28)',
                  background: 'rgba(15, 23, 42, 0.88)',
                  color: '#f8fafc',
                  padding: '0 16px'
                }}
              >
                {showValue ? '隐藏' : '显示'}
              </button>
            </div>
          </label>

          <div
            style={{
              borderRadius: '18px',
              border: '1px solid rgba(125, 211, 252, 0.32)',
              background:
                'linear-gradient(135deg, rgba(14, 165, 233, 0.16), rgba(37, 99, 235, 0.12))',
              padding: '18px 20px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '16px',
              flexWrap: 'wrap'
            }}
          >
            <div style={{ minWidth: '220px' }}>
              <p
                style={{
                  margin: 0,
                  color: '#7dd3fc',
                  fontSize: '0.7rem',
                  letterSpacing: '0.18em',
                  textTransform: 'uppercase'
                }}
              >
                推荐 · LiveToken
              </p>
              <p
                style={{
                  margin: '6px 0 0',
                  color: '#f8fafc',
                  fontSize: '0.98rem',
                  lineHeight: 1.5
                }}
              >
                还没有 API Key？前往 livetoken.top 注册并领取，即可直接配合安装器开箱使用。
              </p>
            </div>
            <button
              type="button"
              onClick={() => onOpenProviderSite?.()}
              style={{
                borderRadius: '999px',
                border: '1px solid rgba(125, 211, 252, 0.65)',
                background: 'rgba(14, 165, 233, 0.18)',
                color: '#e0f2fe',
                padding: '10px 18px',
                fontWeight: 600,
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              前往 livetoken.top
            </button>
          </div>
        </div>

        <div
          style={{
            ...sectionStyle,
            borderTop: '1px solid rgba(148, 163, 184, 0.16)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '16px'
          }}
        >
          <p style={{ margin: 0, color: 'rgba(148, 163, 184, 0.88)' }}>
            日志和导出的诊断报告都会自动隐藏 Key。
          </p>
          <button
            type="button"
            disabled={!canContinueFromApiKeyState(state)}
            onClick={() => {
              if (!canContinueFromApiKeyState(state)) {
                return
              }

              onContinue?.({
                apiKeyMode: toInstallerApiKeyMode(state),
                keyValue: value
              })
            }}
            style={{
              borderRadius: '999px',
              border: 'none',
              background: canContinueFromApiKeyState(state)
                ? 'linear-gradient(135deg, #38bdf8, #2563eb)'
                : 'rgba(71, 85, 105, 0.65)',
              color: '#eff6ff',
              padding: '14px 22px',
              fontWeight: 700
            }}
          >
            继续
          </button>
        </div>
      </div>
    </section>
  )
}
