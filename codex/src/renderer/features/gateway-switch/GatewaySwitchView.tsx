import { useEffect, useState, type CSSProperties } from 'react'

import {
  DEFAULT_GEMINI_MODEL,
  switchTargetLabels,
  switchTargets,
  type GatewayProfile,
  type GatewayProfilesState,
  type SaveGatewayProfileRequest,
  type SaveGatewayProfileResult,
  type SwitchGatewayRequest,
  type SwitchGatewayResult,
  type SwitchTarget
} from '../../../shared/gateway-switch'
import { codexModels, DEFAULT_MODEL, type GatewayModel } from '../../../shared/models'
import type { NetworkMode, ProviderId } from '../../../shared/provider-config'
import {
  providerChoices,
  toProviderAndMode,
  toProviderChoice,
  type ProviderChoice
} from '../api-key/ApiKeyStep'

interface GatewaySwitchViewProps {
  onBack: () => void
  onDelete: (id: string) => Promise<{ ok: boolean; message?: string }>
  onListModels?: (args: {
    apiKey: string
    provider: ProviderId
    networkMode: NetworkMode
  }) => Promise<GatewayModel[]>
  onLoad: () => Promise<GatewayProfilesState>
  onSave: (input: SaveGatewayProfileRequest) => Promise<SaveGatewayProfileResult>
  onSwitch: (input: SwitchGatewayRequest) => Promise<SwitchGatewayResult>
  /** refresh ~/.codex/models-catalog.json from this gateway, using its saved key */
  onSyncCatalog?: (
    profileId: string
  ) => Promise<{ ok: boolean; count: number; gatewayCount?: number; message?: string }>
}

interface Draft {
  id?: string
  name: string
  providerChoice: ProviderChoice
  apiKey: string
  codexModel: string
  geminiModel: string
}

const emptyDraft: Draft = {
  name: '',
  providerChoice: 'solaeon-auto',
  apiKey: '',
  codexModel: DEFAULT_MODEL,
  geminiModel: DEFAULT_GEMINI_MODEL
}

const panelStyle = {
  minHeight: '100vh',
  background: 'radial-gradient(circle at top, rgba(48, 120, 255, 0.14), transparent 40%), #09111f',
  color: '#f3f7ff',
  padding: '32px'
} satisfies CSSProperties

const cardStyle = {
  borderRadius: '24px',
  border: '1px solid rgba(148, 163, 184, 0.24)',
  background: 'rgba(15, 23, 42, 0.78)',
  padding: '22px 24px',
  display: 'grid',
  gap: '12px'
} satisfies CSSProperties

const inputStyle = {
  width: '100%',
  boxSizing: 'border-box',
  borderRadius: '12px',
  border: '1px solid rgba(148, 163, 184, 0.3)',
  background: 'rgba(2, 6, 23, 0.6)',
  color: '#f3f7ff',
  padding: '10px 12px',
  fontSize: '0.95rem'
} satisfies CSSProperties

const pillButton = (tone: 'primary' | 'ghost' | 'danger', disabled = false) =>
  ({
    border:
      tone === 'primary'
        ? 'none'
        : tone === 'danger'
          ? '1px solid rgba(248, 113, 113, 0.5)'
          : '1px solid rgba(125, 211, 252, 0.45)',
    background:
      tone === 'primary' ? 'linear-gradient(135deg, #38bdf8, #2563eb)' : 'transparent',
    color: tone === 'primary' ? '#eff6ff' : tone === 'danger' ? '#fca5a5' : '#7dd3fc',
    borderRadius: '999px',
    padding: '8px 18px',
    fontWeight: tone === 'primary' ? 700 : 500,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.55 : 1
  }) satisfies CSSProperties

const muted = { margin: 0, color: 'rgba(226, 232, 240, 0.72)', lineHeight: 1.6 } satisfies CSSProperties

function describeProvider(profile: GatewayProfile) {
  return (
    providerChoices.find((c) => c.id === toProviderChoice(profile.provider, profile.networkMode))
      ?.title ?? profile.provider
  )
}

export function GatewaySwitchView({
  onBack,
  onDelete,
  onListModels,
  onLoad,
  onSave,
  onSwitch,
  onSyncCatalog
}: GatewaySwitchViewProps) {
  const [state, setState] = useState<GatewayProfilesState | null>(null)
  const [targets, setTargets] = useState<SwitchTarget[]>(['codex', 'gemini'])
  const [draft, setDraft] = useState<Draft | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [switchingId, setSwitchingId] = useState<string | null>(null)
  const [result, setResult] = useState<SwitchGatewayResult | null>(null)
  const [gatewayModels, setGatewayModels] = useState<GatewayModel[]>([])
  const [loadingModels, setLoadingModels] = useState(false)
  const [syncingId, setSyncingId] = useState<string | null>(null)
  const [catalogStatus, setCatalogStatus] = useState<{ profileId: string; ok: boolean; text: string } | null>(
    null
  )

  const reload = () => onLoad().then(setState)

  useEffect(() => {
    void reload()
  }, [])

  const codexSuggestions = [
    ...new Set([
      ...codexModels.map((model) => model.id),
      ...gatewayModels.map((model) => model.id).filter((id) => !id.startsWith('gemini'))
    ])
  ]
  const geminiSuggestions = [
    ...new Set([
      DEFAULT_GEMINI_MODEL,
      ...gatewayModels.map((model) => model.id).filter((id) => id.startsWith('gemini'))
    ])
  ]

  function toggleTarget(target: SwitchTarget) {
    setTargets((current) =>
      current.includes(target) ? current.filter((t) => t !== target) : [...current, target]
    )
  }

  async function saveDraft() {
    if (!draft) return
    setSaving(true)
    setFormError(null)
    const { provider, networkMode } = toProviderAndMode(draft.providerChoice)
    const saved = await onSave({
      id: draft.id,
      name: draft.name,
      provider,
      networkMode,
      codexModel: draft.codexModel,
      geminiModel: draft.geminiModel,
      apiKey: draft.apiKey.trim() || undefined
    })
    setSaving(false)
    if (!saved.ok) {
      setFormError(saved.message)
      return
    }
    setDraft(null)
    await reload()
  }

  async function fetchModels() {
    if (!draft || !onListModels || !draft.apiKey.trim()) return
    setLoadingModels(true)
    try {
      setGatewayModels(
        await onListModels({ apiKey: draft.apiKey.trim(), ...toProviderAndMode(draft.providerChoice) })
      )
    } finally {
      setLoadingModels(false)
    }
  }

  async function switchTo(profile: GatewayProfile) {
    setSwitchingId(profile.id)
    setResult(null)
    try {
      setResult(await onSwitch({ profileId: profile.id, targets }))
      await reload()
    } finally {
      setSwitchingId(null)
    }
  }

  async function syncCatalog(profile: GatewayProfile) {
    if (!onSyncCatalog) return
    setSyncingId(profile.id)
    setCatalogStatus(null)
    try {
      const synced = await onSyncCatalog(profile.id)
      setCatalogStatus({
        profileId: profile.id,
        ok: synced.ok,
        text: synced.ok
          ? `✓ 已更新 Codex 模型目录：共 ${synced.count} 个模型（网关 ${synced.gatewayCount ?? 0} + 内置补充）。重开 Codex，/model 即可看到。`
          : `✗ ${synced.message ?? '更新失败'}`
      })
    } catch {
      setCatalogStatus({ profileId: profile.id, ok: false, text: '✗ 更新失败，请重试。' })
    } finally {
      setSyncingId(null)
    }
  }

  async function remove(profile: GatewayProfile) {
    const removed = await onDelete(profile.id)
    if (!removed.ok) {
      setResult({ message: removed.message, ok: false, results: [] })
    }
    await reload()
  }

  const profiles = state?.profiles ?? []

  return (
    <section style={panelStyle}>
      <div style={{ maxWidth: '920px', margin: '0 auto', display: 'grid', gap: '18px' }}>
        <div>
          <button type="button" onClick={onBack} style={pillButton('ghost')}>
            ← 返回
          </button>
        </div>
        <p style={{ margin: 0, color: '#7dd3fc', letterSpacing: '0.16em', fontSize: '0.75rem' }}>
          切换网关
        </p>
        <h1 style={{ margin: 0 }}>一键切换 Codex / Gemini CLI 的网关，无需重装。</h1>
        <p style={muted}>
          切换只改各工具里安装器负责的几项（网关地址、Key、默认模型），MCP、插件、项目等其他配置保持不变，改之前会先备份原文件。
          Key 加密保存在本机，只显示掩码。切换后请新开终端或重启 Codex / Gemini CLI 生效。
        </p>

        {state?.error ? (
          <p role="alert" style={{ ...muted, color: '#f87171' }}>
            读取已保存的网关失败：{state.error}
          </p>
        ) : null}

        <div style={cardStyle}>
          <strong>切换哪些工具</strong>
          <div style={{ display: 'flex', gap: '18px', flexWrap: 'wrap' }}>
            {switchTargets.map((target) => (
              <label key={target} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input
                  type="checkbox"
                  checked={targets.includes(target)}
                  onChange={() => toggleTarget(target)}
                />
                {switchTargetLabels[target]}
              </label>
            ))}
          </div>
          {targets.includes('gemini') ? (
            <p style={{ ...muted, fontSize: '0.85rem' }}>
              Gemini CLI 需要网关开放 Gemini 接口：目前 SolaEon 只有内网支持。切换前会先探测，网关不支持时只跳过 Gemini，Codex 照常切换。
            </p>
          ) : null}
          {state && !state.geminiInstalled && targets.includes('gemini') ? (
            <p style={{ ...muted, fontSize: '0.85rem' }}>
              未检测到 gemini 命令：仍会写好配置，装上 Gemini CLI（npm i -g @google/gemini-cli）后即可直接使用。
            </p>
          ) : null}
        </div>

        {state && profiles.length === 0 && !draft ? (
          <p style={muted}>还没有保存的网关。先新建一个，例如「SolaEon 内网」「SolaEon 外网 · 个人 Key」。</p>
        ) : null}

        {profiles.map((profile) => {
          const active = profile.id === state?.activeProfileId
          const busy = switchingId === profile.id
          return (
            <div
              key={profile.id}
              data-testid={`gateway-profile-${profile.id}`}
              style={{
                ...cardStyle,
                border: active
                  ? '1px solid rgba(52, 211, 153, 0.6)'
                  : cardStyle.border
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                <strong style={{ fontSize: '1.05rem' }}>
                  {profile.name}
                  {active ? <span style={{ color: '#34d399', marginLeft: '10px' }}>● 当前</span> : null}
                </strong>
                <span style={{ color: '#7dd3fc' }}>{profile.keyMask}</span>
              </div>
              <p style={muted}>
                {describeProvider(profile)} · Codex 模型 {profile.codexModel} · Gemini 模型 {profile.geminiModel}
              </p>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  disabled={busy || !targets.length}
                  onClick={() => void switchTo(profile)}
                  style={pillButton('primary', busy || !targets.length)}
                >
                  {busy ? '切换中…' : `切换到「${profile.name}」`}
                </button>
                {onSyncCatalog ? (
                  <button
                    type="button"
                    disabled={syncingId === profile.id}
                    onClick={() => void syncCatalog(profile)}
                    title="用这个网关的 Key 重新拉取模型，写入 ~/.codex/models-catalog.json"
                    style={pillButton('ghost', syncingId === profile.id)}
                  >
                    {syncingId === profile.id ? '更新中…' : '⬇ 更新模型目录'}
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => {
                    setFormError(null)
                    setDraft({
                      id: profile.id,
                      name: profile.name,
                      providerChoice: toProviderChoice(profile.provider, profile.networkMode),
                      apiKey: '',
                      codexModel: profile.codexModel,
                      geminiModel: profile.geminiModel
                    })
                  }}
                  style={pillButton('ghost')}
                >
                  编辑
                </button>
                <button type="button" onClick={() => void remove(profile)} style={pillButton('danger')}>
                  删除
                </button>
              </div>
              {catalogStatus?.profileId === profile.id ? (
                <p role="status" style={{ ...muted, color: catalogStatus.ok ? '#34d399' : '#f87171' }}>
                  {catalogStatus.text}
                </p>
              ) : null}
            </div>
          )
        })}

        {result ? (
          <div role="status" style={{ ...cardStyle, borderColor: result.ok ? 'rgba(52, 211, 153, 0.5)' : 'rgba(248, 113, 113, 0.5)' }}>
            {result.message ? <p style={{ ...muted, color: '#f87171' }}>{result.message}</p> : null}
            {result.results.map((item) => (
              <p key={item.target} style={{ ...muted, color: item.ok ? '#34d399' : '#f87171' }}>
                {item.ok ? '✓' : '✗'} {switchTargetLabels[item.target]}：{item.message}
              </p>
            ))}
          </div>
        ) : null}

        {draft ? (
          <div style={cardStyle}>
            <strong>{draft.id ? '编辑网关' : '新建网关'}</strong>
            <label style={{ display: 'grid', gap: '6px' }}>
              名称
              <input
                aria-label="网关名称"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="例如：SolaEon 内网"
                style={inputStyle}
              />
            </label>
            <label style={{ display: 'grid', gap: '6px' }}>
              网关
              <select
                aria-label="网关"
                value={draft.providerChoice}
                onChange={(e) => setDraft({ ...draft, providerChoice: e.target.value as ProviderChoice })}
                style={inputStyle}
              >
                {providerChoices.map((choice) => (
                  <option key={choice.id} value={choice.id}>
                    {choice.title} — {choice.detail}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ display: 'grid', gap: '6px' }}>
              API Key{draft.id ? '（留空则保留原 Key）' : ''}
              <input
                aria-label="网关 API Key"
                type="password"
                value={draft.apiKey}
                onChange={(e) => setDraft({ ...draft, apiKey: e.target.value })}
                placeholder="sk-..."
                style={inputStyle}
              />
            </label>
            <div style={{ display: 'grid', gap: '10px', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
              <label style={{ display: 'grid', gap: '6px' }}>
                Codex 默认模型
                <input
                  aria-label="Codex 默认模型"
                  list="gateway-codex-models"
                  value={draft.codexModel}
                  onChange={(e) => setDraft({ ...draft, codexModel: e.target.value })}
                  style={inputStyle}
                />
              </label>
              <label style={{ display: 'grid', gap: '6px' }}>
                Gemini 默认模型
                <input
                  aria-label="Gemini 默认模型"
                  list="gateway-gemini-models"
                  value={draft.geminiModel}
                  onChange={(e) => setDraft({ ...draft, geminiModel: e.target.value })}
                  style={inputStyle}
                />
              </label>
            </div>
            <datalist id="gateway-codex-models">
              {codexSuggestions.map((id) => (
                <option key={id} value={id} />
              ))}
            </datalist>
            <datalist id="gateway-gemini-models">
              {geminiSuggestions.map((id) => (
                <option key={id} value={id} />
              ))}
            </datalist>
            {formError ? (
              <p role="alert" style={{ ...muted, color: '#f87171' }}>
                {formError}
              </p>
            ) : null}
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button
                type="button"
                disabled={saving}
                onClick={() => void saveDraft()}
                style={pillButton('primary', saving)}
              >
                {saving ? '保存中…' : '保存'}
              </button>
              {onListModels ? (
                <button
                  type="button"
                  disabled={loadingModels || !draft.apiKey.trim()}
                  onClick={() => void fetchModels()}
                  title="需要先填 API Key"
                  style={pillButton('ghost', loadingModels || !draft.apiKey.trim())}
                >
                  {loadingModels ? '拉取中…' : '⟳ 从网关拉取模型'}
                </button>
              ) : null}
              <button type="button" onClick={() => setDraft(null)} style={pillButton('ghost')}>
                取消
              </button>
            </div>
          </div>
        ) : (
          <div>
            <button
              type="button"
              onClick={() => {
                setFormError(null)
                setDraft({ ...emptyDraft })
              }}
              style={pillButton('ghost')}
            >
              ＋ 新建网关
            </button>
          </div>
        )}
      </div>
    </section>
  )
}
