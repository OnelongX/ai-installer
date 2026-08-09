import { useState, type CSSProperties } from 'react'

import type { NetworkProbeResult } from '../../../shared/ipc'
import {
  codexModels,
  DEFAULT_MODEL,
  modelsFromIds,
  type CodexModel
} from '../../../shared/models'
import type { NetworkMode, ProviderId } from '../../../shared/provider-config'
import {
  canContinueFromApiKeyState,
  toInstallerApiKeyMode,
  type ApiKeySelectionMode,
  type ApiKeyViewState
} from './api-key-state'

type ProviderChoice = 'livetoken' | 'solaeon-auto' | 'solaeon-internal' | 'solaeon-external'

function toProviderAndMode(choice: ProviderChoice): {
  provider: ProviderId
  networkMode: NetworkMode
} {
  switch (choice) {
    case 'livetoken':
      return { provider: 'livetoken', networkMode: 'auto' }
    case 'solaeon-internal':
      return { provider: 'solaeon', networkMode: 'internal' }
    case 'solaeon-external':
      return { provider: 'solaeon', networkMode: 'external' }
    case 'solaeon-auto':
    default:
      return { provider: 'solaeon', networkMode: 'auto' }
  }
}

const providerChoices: Array<{
  id: ProviderChoice
  title: string
  detail: string
}> = [
  { id: 'livetoken', title: 'LiveToken', detail: '公共网关 · https://livetoken.top/v1' },
  {
    id: 'solaeon-auto',
    title: 'Solaeon · 自动',
    detail: '先探测内网，通则内网，否则外网'
  },
  { id: 'solaeon-internal', title: 'Solaeon · 内网', detail: 'http://192.168.1.101:48760' },
  { id: 'solaeon-external', title: 'Solaeon · 外网', detail: 'https://ai-api.solaeon.com' }
]

interface ApiKeyStepProps {
  existingKeyMask?: string
  canReuseExistingKey?: boolean
  onContinue?: (state: {
    apiKeyMode: 'existing' | 'user-env'
    keyValue: string
    provider: ProviderId
    networkMode: NetworkMode
    model: string
  }) => void
  onOpenProviderSite?: () => void
  onProbeNetwork?: () => Promise<NetworkProbeResult>
  onListModels?: (args: {
    apiKey: string
    provider: ProviderId
    networkMode: NetworkMode
  }) => Promise<string[]>
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
  onOpenProviderSite,
  onProbeNetwork,
  onListModels
}: ApiKeyStepProps) {
  const [mode, setMode] = useState<ApiKeySelectionMode>(null)
  const [showValue, setShowValue] = useState(false)
  const [value, setValue] = useState('')
  const [providerChoice, setProviderChoice] = useState<ProviderChoice>('livetoken')
  const [model, setModel] = useState<string>(DEFAULT_MODEL)
  const [availableModels, setAvailableModels] = useState<CodexModel[]>(codexModels)
  const [modelsFromGateway, setModelsFromGateway] = useState(false)
  const [loadingModels, setLoadingModels] = useState(false)
  const [probe, setProbe] = useState<NetworkProbeResult | null>(null)
  const [probing, setProbing] = useState(false)

  const runProbe = () => {
    if (!onProbeNetwork) {
      return
    }
    setProbing(true)
    void onProbeNetwork()
      .then((result) => setProbe(result))
      .catch(() => setProbe(null))
      .finally(() => setProbing(false))
  }

  const refreshModels = () => {
    const key = value.trim()
    if (!onListModels || !key) {
      return
    }
    const { provider, networkMode } = toProviderAndMode(providerChoice)
    setLoadingModels(true)
    void onListModels({ apiKey: key, provider, networkMode })
      .then((ids) => {
        if (ids.length === 0) {
          return
        }
        const next = modelsFromIds(ids)
        setAvailableModels(next)
        setModelsFromGateway(true)
        // Keep the selection if still offered, else pick the first live model.
        if (!next.some((m) => m.id === model)) {
          setModel(next[0].id)
        }
      })
      .catch(() => {
        /* keep the fallback list */
      })
      .finally(() => setLoadingModels(false))
  }

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

          <div style={{ display: 'grid', gap: '10px' }}>
            <span style={{ color: 'rgba(226, 232, 240, 0.9)' }}>模型服务地址</span>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '10px'
              }}
            >
              {providerChoices.map((choice) => (
                <button
                  key={choice.id}
                  type="button"
                  onClick={() => {
                    setProviderChoice(choice.id)
                    if (choice.id === 'solaeon-auto') {
                      runProbe()
                    }
                  }}
                  style={optionStyle(providerChoice === choice.id)}
                >
                  <strong style={{ fontSize: '0.95rem' }}>{choice.title}</strong>
                  <p
                    style={{
                      margin: '6px 0 0',
                      color: 'rgba(226, 232, 240, 0.7)',
                      fontSize: '0.8rem',
                      wordBreak: 'break-all'
                    }}
                  >
                    {choice.detail}
                  </p>
                </button>
              ))}
            </div>
            {providerChoice === 'solaeon-auto' ? (
              <p
                style={{
                  margin: 0,
                  color: '#7dd3fc',
                  fontSize: '0.82rem'
                }}
              >
                {probing
                  ? '正在探测内网 192.168.1.101:48760 …'
                  : probe
                    ? probe.internalReachable
                      ? `内网可达，将使用 ${probe.resolvedBaseUrl}`
                      : `内网不可达，将回落到 ${probe.resolvedBaseUrl}`
                    : '安装时会自动探测内网是否可达；也可点上面「内网/外网」手动指定。'}
              </p>
            ) : null}
          </div>

          <div style={{ display: 'grid', gap: '10px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px'
              }}
            >
              <span style={{ color: 'rgba(226, 232, 240, 0.9)' }}>默认模型</span>
              <button
                type="button"
                onClick={refreshModels}
                disabled={loadingModels || !value.trim()}
                style={{
                  border: '1px solid rgba(125, 211, 252, 0.45)',
                  background: 'transparent',
                  color: value.trim() ? '#7dd3fc' : 'rgba(148, 163, 184, 0.55)',
                  borderRadius: '999px',
                  padding: '5px 14px',
                  fontSize: '0.78rem',
                  cursor: value.trim() ? 'pointer' : 'not-allowed'
                }}
              >
                {loadingModels ? '拉取中…' : '⟳ 从网关拉取'}
              </button>
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '10px'
              }}
            >
              {availableModels.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setModel(m.id)}
                  style={optionStyle(model === m.id)}
                >
                  <strong style={{ fontSize: '0.95rem' }}>{m.label}</strong>
                  <p
                    style={{
                      margin: '6px 0 0',
                      color: 'rgba(226, 232, 240, 0.7)',
                      fontSize: '0.8rem'
                    }}
                  >
                    {m.detail}
                  </p>
                </button>
              ))}
            </div>
            <p style={{ margin: 0, color: 'rgba(148, 163, 184, 0.85)', fontSize: '0.8rem' }}>
              {modelsFromGateway
                ? '已按网关 /v1/models 实时列出；DeepSeek / Kimi 等经网关透传，同一把 Key 即可切换。'
                : '默认列表；填好 Key 后点「从网关拉取」可换成网关实时支持的全部模型。'}
            </p>
          </div>

          <label
            style={{
              display: 'grid',
              gap: '10px',
              color: 'rgba(226, 232, 240, 0.9)'
            }}
          >
            <span>API Key</span>
            <div style={{ position: 'relative' }}>
              <input
                aria-label="API Key"
                type={showValue ? 'text' : 'password'}
                value={value}
                onChange={(event) => {
                  setMode('new')
                  setValue(event.target.value)
                }}
                onBlur={() => {
                  // Auto-pull the live model list once a key is present, so the
                  // picker reflects the gateway without a manual click.
                  if (!modelsFromGateway && value.trim()) {
                    refreshModels()
                  }
                }}
                placeholder="sk-..."
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  borderRadius: '16px',
                  border: '1px solid rgba(148, 163, 184, 0.28)',
                  background: 'rgba(2, 6, 23, 0.66)',
                  color: '#f8fafc',
                  padding: '14px 76px 14px 16px',
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                  letterSpacing: '0.02em'
                }}
              />
              <button
                type="button"
                onClick={() => setShowValue((current) => !current)}
                aria-label={showValue ? '隐藏 API Key' : '显示 API Key'}
                style={{
                  position: 'absolute',
                  top: '50%',
                  right: '8px',
                  transform: 'translateY(-50%)',
                  border: 'none',
                  background: 'transparent',
                  color: 'rgba(148, 163, 184, 0.9)',
                  padding: '6px 10px',
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  borderRadius: '10px',
                  transition: 'color 0.15s, background 0.15s'
                }}
                onMouseEnter={(event) => {
                  event.currentTarget.style.color = '#e0f2fe'
                  event.currentTarget.style.background = 'rgba(56, 189, 248, 0.12)'
                }}
                onMouseLeave={(event) => {
                  event.currentTarget.style.color = 'rgba(148, 163, 184, 0.9)'
                  event.currentTarget.style.background = 'transparent'
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

              const { provider, networkMode } = toProviderAndMode(providerChoice)
              onContinue?.({
                apiKeyMode: toInstallerApiKeyMode(state),
                keyValue: value,
                provider,
                networkMode,
                model
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
