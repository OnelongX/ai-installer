#!/usr/bin/env bash
#
# install_codex.sh — 一行命令在 macOS / Linux / WSL 上把 Codex CLI 装到位
#
# 做的事和 Windows 上的 Codex 安装器一一对位：
#   1. 检测 / 安装 Node.js (brew / apt / dnf / pacman / zypper / fnm 兜底)
#   2. npm i -g @openai/codex
#   3. 写 ~/.codex/config.toml (SolaEon 网关，内网 / 外网自动选择 + gpt-5.5 high) 和 models-catalog.json
#   4. 把 OPENAI_API_KEY 写进 ~/.zshrc / ~/.bashrc
#   5. 跑 codex --version 验证
#
# 也存在一个老 Python 脚本 install_codex_macos.py，那个只装 CLI 不配网关。
# 推荐用本脚本（bash，macOS + Linux 通用，配置完整）。
#
# 用法：
#   ./install_codex.sh                                          # 交互式
#   ./install_codex.sh --api-key sk-xxx
#   ./install_codex.sh --network internal                       # 强制内网 (auto|internal|external)
#   curl -fsSL https://raw.githubusercontent.com/OnelongX/ai-installer/main/codex/install_codex.sh | bash -s -- --api-key sk-xxx

set -euo pipefail

API_KEY="${API_KEY:-}"
# Same provider catalog as src/shared/provider-config.ts (checked by
# tests/unit/install-sh-parity.test.ts).
SOLAEON_INTERNAL="http://192.168.1.101:48760"
SOLAEON_EXTERNAL="https://ai-api.solaeon.com"
PROVIDER="solaeon"
NETWORK="auto"
BASE_URL=""
DEFAULT_MODEL="gpt-5.5"
NPM_PACKAGE="@openai/codex"
SKIP_NODE=0
SKIP_RC=0
NON_INTERACTIVE=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --api-key)         API_KEY="$2"; shift 2 ;;
    --provider)        PROVIDER="$2"; shift 2 ;;
    --network)         NETWORK="$2"; shift 2 ;;
    --base-url)        BASE_URL="$2"; shift 2 ;;
    --model)           DEFAULT_MODEL="$2"; shift 2 ;;
    --skip-node)       SKIP_NODE=1; shift ;;
    --skip-rc)         SKIP_RC=1; shift ;;
    --non-interactive) NON_INTERACTIVE=1; shift ;;
    -h|--help) sed -n '2,20p' "$0" | sed 's/^#\s\?//'; exit 0 ;;
    *) echo "未知参数: $1" >&2; exit 2 ;;
  esac
done
case "$PROVIDER" in
  solaeon) PROVIDER_NAME="Solaeon" ;;
  # LiveToken was offered here until it went offline.
  *) echo "未知 --provider: $PROVIDER（只支持 solaeon；LiveToken 已下线）" >&2; exit 2 ;;
esac
case "$NETWORK" in
  auto|internal|external) ;;
  *) echo "未知 --network: $NETWORK（可选 auto / internal / external）" >&2; exit 2 ;;
esac

c=$'\033'; cyan="${c}[1;36m"; green="${c}[1;32m"; yellow="${c}[1;33m"; red="${c}[1;31m"; reset="${c}[0m"
step()  { printf "\n${cyan}==> %s${reset}\n" "$1"; }
ok()    { printf "    ${green}[ok]${reset} %s\n" "$1"; }
warn()  { printf "    ${yellow}[warn]${reset} %s\n" "$1"; }
fail()  { printf "    ${red}[fail]${reset} %s\n" "$1" >&2; }
has()   { command -v "$1" >/dev/null 2>&1; }

# 0. platform check
OS="$(uname -s)"
case "$OS" in
  Darwin|Linux) ;;
  *) fail "不支持的系统：$OS。本脚本面向 macOS / Linux / WSL；Windows 请用 Codex 安装器。"; exit 1 ;;
esac

# 1. ensure node
step "检测 Node.js / npm"
if has node && has npm; then
  ok "Node.js $(node -v) / npm $(npm -v) 已就位"
elif [[ $SKIP_NODE -eq 1 ]]; then
  fail "未检测到 node / npm，且 --skip-node 指定。先手动装好 Node 20+ 再回头。"
  exit 1
else
  warn "未检测到 Node.js，自动安装…"
  installed=0
  if [[ "$OS" == "Darwin" ]]; then
    if has brew; then
      step "brew install node"
      brew install node && installed=1
    fi
  else
    if has apt-get; then
      step "apt-get install nodejs"
      if has curl; then
        curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash - && sudo apt-get install -y nodejs && installed=1
      else
        sudo apt-get update && sudo apt-get install -y nodejs npm && installed=1
      fi
    elif has dnf; then
      sudo dnf install -y nodejs npm && installed=1
    elif has pacman; then
      sudo pacman -S --noconfirm nodejs npm && installed=1
    elif has zypper; then
      sudo zypper install -y nodejs npm && installed=1
    fi
  fi
  if [[ $installed -ne 1 ]]; then
    warn "包管理器装 Node 没成。回落到 fnm。"
    if ! has fnm; then
      curl -fsSL https://fnm.vercel.app/install | bash
      export PATH="$HOME/.local/share/fnm:$PATH"
      eval "$(fnm env --use-on-cd 2>/dev/null || true)"
    fi
    if has fnm; then
      fnm install --lts
      fnm use lts-latest
      eval "$(fnm env)"
    fi
  fi
  if ! has node || ! has npm; then
    fail "Node 装完了还是找不到。重新打开终端再试。"
    exit 1
  fi
  ok "Node.js $(node -v) / npm $(npm -v)"
fi

# 1b. resolve gateway (mirrors resolveProvider + probeSolaeonInternal)
step "选择网关：$PROVIDER_NAME"
if [[ -z "$BASE_URL" ]]; then
  if [[ "$NETWORK" == "internal" ]]; then
    BASE_URL="$SOLAEON_INTERNAL"
  elif [[ "$NETWORK" == "external" ]]; then
    BASE_URL="$SOLAEON_EXTERNAL"
  # auto: TCP-probe the LAN box (1.5s), fall back to the WAN address
  elif node -e '
    const u = new URL(process.argv[1])
    const s = require("net").connect(Number(u.port) || 80, u.hostname)
    s.setTimeout(1500)
    s.on("connect", () => process.exit(0))
    s.on("timeout", () => process.exit(1))
    s.on("error", () => process.exit(1))
  ' "$SOLAEON_INTERNAL"; then
    BASE_URL="$SOLAEON_INTERNAL"
  else
    BASE_URL="$SOLAEON_EXTERNAL"
  fi
fi
ok "base_url = $BASE_URL"

# 2. resolve key
step "取 $PROVIDER_NAME API Key"
if [[ -z "$API_KEY" ]]; then
  API_KEY="${OPENAI_API_KEY:-}"
  [[ -n "$API_KEY" ]] && warn "复用环境变量里已有的 Key"
fi
if [[ -z "$API_KEY" ]]; then
  if [[ $NON_INTERACTIVE -eq 1 ]]; then
    fail "非交互模式下必须传 --api-key。"
    exit 1
  fi
  printf "请粘贴 SolaEon API Key: "
  stty -echo; read -r API_KEY; stty echo; printf "\n"
fi
API_KEY="${API_KEY// /}"
[[ -z "$API_KEY" ]] && { fail "API Key 为空"; exit 1; }
mask="***"
[[ ${#API_KEY} -ge 8 ]] && mask="${API_KEY:0:2}***${API_KEY: -4}"
ok "Key 已读取: $mask"

# 3. install codex CLI
step "安装 $NPM_PACKAGE"
npm install -g "$NPM_PACKAGE"
ok "npm i -g $NPM_PACKAGE 完成"

# 4. write ~/.codex/config.toml
step "写入 ~/.codex/config.toml"
home_dir="${HOME:-/}"
conf_dir="$home_dir/.codex"
conf="$conf_dir/config.toml"
mkdir -p "$conf_dir"
backup=""
if [[ -f "$conf" ]]; then
  stamp="$(date +%Y%m%d-%H%M%S)"
  backup="$conf.bak.$stamp"
  cp "$conf" "$backup"
  ok "已备份 → $backup"
fi

catalog="$conf_dir/models-catalog.json"

# Same template as renderConfigToml in src/main/installer/tasks/write-config.windows.ts
# (tests/unit/install-sh-parity.test.ts compares them; comment lines are ignored).
cat > "$conf.new" <<TOML
# Generated by ai-installer / install_codex.sh — $PROVIDER_NAME provider defaults
personality = "pragmatic"
model = "$DEFAULT_MODEL"
model_provider = "cm"
model_catalog_json = '$catalog'
# Force API-key auth: without it Codex falls back to ChatGPT login and never uses env_key.
forced_login_method = "api"
review_model = "$DEFAULT_MODEL"
model_reasoning_effort = "high"
plan_mode_reasoning_effort = "xhigh"
model_reasoning_summary = "detailed"
model_verbosity = "medium"
approval_policy = "on-request"
allow_login_shell = true
sandbox_mode = "workspace-write"
cli_auth_credentials_store = "file"
chatgpt_base_url = "https://chatgpt.com/backend-api/"
mcp_oauth_credentials_store = "auto"
check_for_update_on_startup = true
web_search = "live"
approvals_reviewer = "user"

[model_providers.cm]
name = "$PROVIDER_NAME"
base_url = "$BASE_URL"
wire_api = "responses"
env_key = "OPENAI_API_KEY"

[desktop]
# Codex desktop's Work mode / STEPS_PROSE needs a ChatGPT login and blocks api-key users.
conversationDetailMode = "STEPS_COMMANDS"
TOML

if [[ -n "$backup" ]]; then
  # Merge instead of overwrite: only installer-owned keys change; mcp_servers,
  # plugins, projects, other [desktop] keys … are kept. [model_providers.cm] is
  # replaced outright. Same algorithm as src/main/installer/tasks/merge-config.ts
  # (tests/unit/merge-config.test.ts checks both agree).
  # Write to a temp file first so a failed merge never truncates config.toml.
  node - "$backup" "$conf.new" > "$conf.merged" <<'MERGE_JS'
const fs = require('fs')
const REPLACE = new Set(['model_providers.cm'])
const HEADER = /^\s*(\[\[?)\s*([^\]]+?)\s*\]\]?\s*(#.*)?$/
const KEY = /^\s*("(?:[^"\\]|\\.)*"|'[^']*'|[A-Za-z0-9_.-]+)\s*=/
const unquote = (k) => (k[0] === '"' || k[0] === "'" ? k.slice(1, -1) : k)
function scan(t, s) {
  let i = 0
  while (i < t.length) {
    if (s.ml) { const e = t.indexOf(s.ml, i); if (e === -1) return; i = e + 3; s.ml = null; continue }
    const c = t[i]
    if (c === '#') return
    if (t.startsWith('"""', i) || t.startsWith("'''", i)) { s.ml = t.slice(i, i + 3); i += 3; continue }
    if (c === '"') { i++; while (i < t.length && t[i] !== '"') { if (t[i] === '\\') i++; i++ } i++; continue }
    if (c === "'") { const e = t.indexOf("'", i + 1); i = e === -1 ? t.length : e + 1; continue }
    if (c === '[' || c === '{') s.depth++
    else if (c === ']' || c === '}') s.depth--
    i++
  }
}
function parse(text) {
  const tables = [{ arr: false, entries: [], header: null, name: '' }]
  const s = { depth: 0, ml: null }
  let open = null
  for (const line of text.split(/\r?\n/)) {
    if (open) { open.lines.push(line); scan(line, s); if (!s.ml && s.depth <= 0) { open = null; s.depth = 0 } continue }
    const h = HEADER.exec(line)
    if (h) { tables.push({ arr: h[1] === '[[', entries: [], header: line, name: h[2] }); continue }
    const k = KEY.exec(line)
    const entry = { key: k ? unquote(k[1]) : null, lines: [line] }
    tables[tables.length - 1].entries.push(entry)
    if (k) { scan(line.slice(k[0].length), s); if (s.ml || s.depth > 0) open = entry; else s.depth = 0 }
  }
  return tables
}
function trim(lines) {
  let a = 0, b = lines.length
  while (a < b && !lines[a].trim()) a++
  while (b > a && !lines[b - 1].trim()) b--
  return lines.slice(a, b).map((l) => l.trimEnd())
}
const block = (t, extra = []) => {
  const body = [...t.entries, ...extra].flatMap((e) => e.lines)
  return trim(t.header ? [t.header, ...body] : body)
}
const existing = fs.readFileSync(process.argv[2], 'utf8')
const rendered = fs.readFileSync(process.argv[3], 'utf8').replace(/\n+$/, '')
if (!existing.trim()) { process.stdout.write(rendered + '\n'); process.exit(0) }
const ours = parse(rendered), theirs = parse(existing)
const byName = new Map(ours.filter((t) => !t.arr).map((t) => [t.name, t]))
const done = new Set(), blocks = []
for (const t of theirs) {
  const mine = t.arr ? undefined : byName.get(t.name)
  if (mine && !done.has(mine)) {
    done.add(mine)
    const owned = new Set(mine.entries.map((e) => e.key).filter(Boolean))
    const extra = REPLACE.has(mine.name) ? [] : t.entries.filter((e) => e.key && !owned.has(e.key))
    blocks.push(block(mine, extra))
  } else if (!mine) blocks.push(block(t))
}
for (const t of ours) if (!done.has(t)) blocks.push(block(t))
process.stdout.write(blocks.filter((b) => b.length).map((b) => b.join('\n')).join('\n\n') + '\n')
MERGE_JS
  mv "$conf.merged" "$conf"
  rm -f "$conf.new"
  ok "已合并写入 $conf（保留了原有的 MCP / 插件 / 项目等配置）"
else
  mv "$conf.new" "$conf"
  ok "已写入 $conf"
fi

# 4b. models-catalog.json — gateway /v1/models merged with the curated extras,
# so Codex's /model picker lists every gateway model. Port of
# src/shared/model-catalog.ts + fetchGatewayModels (parity-tested). Falls back
# to the extras alone if the gateway can't be reached.
step "生成模型目录 models-catalog.json"
catalog_counts="$(CODEX_GATEWAY_KEY="$API_KEY" node - "$BASE_URL" "$catalog" <<'CATALOG_JS'
const fs = require('fs')
const EXTRA_MODELS = ['gpt-6.1-sol', 'gpt-6.1-terra', 'gpt-6-astra', 'gpt-6-sol', 'gpt-6-luna', 'gpt-5.6-sol',
  'gpt-5.6-terra', 'gpt-5.6-luna', 'gpt-5.6', 'gpt-5.5', 'gpt-5.4', 'gpt-5.4-mini', 'gpt-5.3-codex',
  'gpt-5.3-codex-spark', 'gpt-5.2', 'deepseek-v4-flash', 'deepseek-v4-pro', 'kimi-k3']
const PRIORITY_MAP = [['gpt-6.1-sol', 1], ['gpt-6-astra', 2], ['gpt-6.1-terra', 3], ['gpt-6-sol', 4],
  ['gpt-6-luna', 5], ['gpt-6', 5], ['gpt-5.6-sol', 6], ['gpt-5.6-terra', 7], ['gpt-5.6-luna', 8], ['gpt-5.6', 9],
  ['gpt-5', 10], ['gpt-4', 11], ['claude', 12], ['deepseek-v4', 20], ['deepseek-v3', 21], ['deepseek', 22],
  ['kimi', 23]]
const CONTEXT_WINDOW_MAP = { 'gpt-6.1': 500000, 'gpt-6': 272000, 'gpt-5.6-sol': 272000, 'gpt-5.6-terra': 272000,
  'gpt-5.6-luna': 272000, 'gpt-5.6': 272000, 'gpt-5.5': 272000, 'gpt-5.4': 272000, 'gpt-4o': 128000,
  'gpt-4o-mini': 128000, 'deepseek-v4-pro': 128000, 'deepseek-v4-flash': 128000, 'deepseek-chat': 64000,
  'kimi-k3': 256000, 'claude-opus-4': 200000, 'claude-sonnet-4': 200000 }
const DISPLAY_NAME_MAP = { 'gpt-6.1-sol': 'GPT-6.1 Sol', 'gpt-6.1-terra': 'GPT-6.1 Terra', 'gpt-6-astra': 'GPT-6 Astra',
  'gpt-6-sol': 'GPT-6 Sol', 'gpt-6-luna': 'GPT-6 Luna', 'gpt-5.6-sol': 'GPT-5.6 Sol', 'gpt-5.6-terra': 'GPT-5.6 Terra',
  'gpt-5.6-luna': 'GPT-5.6 Luna', 'gpt-5.6': 'GPT-5.6', 'gpt-5.5': 'GPT-5.5', 'gpt-5.4': 'GPT-5.4',
  'gpt-5.4-mini': 'GPT-5.4 Mini', 'gpt-5.3-codex': 'GPT-5.3-Codex', 'gpt-5.3-codex-spark': 'GPT-5.3-Codex-Spark',
  'gpt-5.2': 'GPT-5.2', 'gpt-4o': 'GPT-4o', 'gpt-4o-mini': 'GPT-4o Mini', 'deepseek-v4-pro': 'DeepSeek V4 Pro',
  'deepseek-v4-flash': 'DeepSeek V4 Flash', 'deepseek-chat': 'DeepSeek Chat', 'kimi-k3': 'Kimi K3' }
const priority = (id) => (PRIORITY_MAP.find(([p]) => id.startsWith(p)) || [null, 99])[1]
function contextWindow(id) {
  if (CONTEXT_WINDOW_MAP[id]) return CONTEXT_WINDOW_MAP[id]
  for (const [k, v] of Object.entries(CONTEXT_WINDOW_MAP)) if (id.startsWith(k)) return v
  return 128000
}
function displayName(id) {
  if (DISPLAY_NAME_MAP[id]) return DISPLAY_NAME_MAP[id]
  if (id.startsWith('claude-')) {
    const parts = id.replace('claude-', '').split('-')
    const head = `Claude ${parts[0].charAt(0).toUpperCase()}${parts[0].slice(1)}`
    return parts.length > 1 ? `${head} ${parts.slice(1).join('-')}` : head
  }
  const gpt = /^gpt-(\d+(?:\.\d+)?)-([a-z]+)$/.exec(id)
  if (gpt) return `GPT-${gpt[1]} ${gpt[2].charAt(0).toUpperCase()}${gpt[2].slice(1)}`
  const parts = id.split('-')
  if (parts.length >= 2) {
    const base = parts.slice(0, 2).join('-').toUpperCase()
    const suffix = parts.slice(2).join('-')
    return suffix ? `${base} (${suffix})` : base
  }
  return id.toUpperCase()
}
function reasoningLevels(id) {
  if (/^gpt-(6|5\.6)/.test(id)) {
    return [{ effort: 'low', description: '更快、推理更轻' }, { effort: 'medium', description: '速度与推理深度均衡' },
      { effort: 'high', description: '更深的推理，适合复杂问题' }, { effort: 'xhigh', description: '最深的推理，适合最难的问题' }]
  }
  if (['gpt-5', 'opus', 'deepseek-v4-pro', 'kimi'].some((t) => id.includes(t))) {
    return [{ effort: 'low', description: '更快、推理更轻' }, { effort: 'medium', description: '速度与推理深度均衡' },
      { effort: 'high', description: '更深的推理，适合复杂问题' }]
  }
  if (id.includes('flash') || id.includes('mini')) {
    return [{ effort: 'low', description: '更快、推理更轻' }, { effort: 'medium', description: '速度与推理深度均衡' }]
  }
  return [{ effort: 'low', description: '更快' }, { effort: 'medium', description: '均衡' }, { effort: 'high', description: '深度推理' }]
}
function entry(id) {
  const cw = contextWindow(id), name = displayName(id), light = id.includes('flash') || id.includes('mini')
  return { slug: id, display_name: name, description: `${name}（SolaEon 网关）`, context_window: cw,
    max_context_window: cw, supported_reasoning_levels: reasoningLevels(id), shell_type: 'shell_command',
    visibility: 'list', supported_in_api: true, priority: priority(id), availability_nux: null, upgrade: null,
    base_instructions: 'You are Codex, a coding agent.', supports_reasoning_summaries: !light,
    support_verbosity: false, default_verbosity: null, apply_patch_tool_type: null,
    truncation_policy: { mode: 'tokens', limit: 10000 }, supports_parallel_tool_calls: true,
    experimental_supported_tools: [] }
}
function extractIds(raw) {
  try {
    const doc = JSON.parse(raw)
    const list = Array.isArray(doc) ? doc : doc && Array.isArray(doc.models) ? doc.models
      : doc && Array.isArray(doc.data) ? doc.data : []
    return list.map((e) => (typeof e === 'string' ? e : e && typeof e === 'object' ? String(e.id ?? e.slug ?? '') : ''))
      .filter((id) => id.length > 0)
  } catch { return [] }
}
async function gatewayIds(baseUrl) {
  const url = `${baseUrl.replace(/\/+$/, '').replace(/\/v1$/i, '')}/v1/models`
  try {
    // No key, no Authorization header: SolaEon lists its models without one.
    const key = (process.env.CODEX_GATEWAY_KEY || '').trim()
    const res = await fetch(url, { headers: key ? { Authorization: `Bearer ${key}` } : {},
      signal: AbortSignal.timeout(15000) })
    return res.ok ? extractIds(await res.text()) : []
  } catch { return [] }
}
;(async () => {
  const fromGateway = await gatewayIds(process.argv[2])
  const seen = new Set(), ids = []
  for (const id of [...fromGateway, ...EXTRA_MODELS]) {
    if (id && !['embedding', 'whisper', 'tts', 'dall-e', 'image'].some((t) => id.includes(t)) && !seen.has(id)) {
      seen.add(id); ids.push(id)
    }
  }
  const models = ids.map(entry).sort((a, b) => a.priority - b.priority)
  fs.writeFileSync(process.argv[3], JSON.stringify({ models }, null, 2))
  console.log(`${fromGateway.length} ${models.length}`)
})()
CATALOG_JS
)"
read -r gateway_count catalog_count <<< "$catalog_counts"
if [[ "${gateway_count:-0}" -eq 0 ]]; then
  warn "网关没返回模型列表（网络或 Key 问题？），目录里只放了内置的 ${catalog_count:-?} 个模型"
else
  ok "已写入 $catalog（${catalog_count} 个模型：网关 ${gateway_count} + 内置补充）"
fi

# 5. shell rc
if [[ $SKIP_RC -eq 0 ]]; then
  step "写入 OPENAI_API_KEY 到 shell rc"
  rc=""
  case "${SHELL:-}" in
    */zsh)  rc="$home_dir/.zshrc" ;;
    */bash) rc="$home_dir/.bashrc" ;;
    *)
      if [[ -f "$home_dir/.zshrc" ]]; then rc="$home_dir/.zshrc"
      elif [[ -f "$home_dir/.bashrc" ]]; then rc="$home_dir/.bashrc"
      elif [[ "$OS" == "Darwin" ]]; then rc="$home_dir/.zshrc"
      else rc="$home_dir/.bashrc"
      fi
      ;;
  esac
  touch "$rc"
  marker="# >>> ai-installer / codex / solaeon >>>"
  end="# <<< ai-installer / codex / solaeon <<<"
  # Drop our previous block, including the old LiveToken-era one, so the key
  # is exported exactly once.
  for tag in solaeon livetoken; do
    m="# >>> ai-installer / codex / $tag >>>"
    e="# <<< ai-installer / codex / $tag <<<"
    if grep -qF "$m" "$rc"; then
      awk -v m="$m" -v e="$e" '$0==m{skip=1;next} skip && $0==e{skip=0;next} !skip{print}' "$rc" > "$rc.tmp" && mv "$rc.tmp" "$rc"
    fi
  done
  {
    printf "\n%s\n" "$marker"
    printf "export OPENAI_API_KEY=%q\n" "$API_KEY"
    printf "%s\n" "$end"
  } >> "$rc"
  ok "已在 $rc 写入 OPENAI_API_KEY=$mask"
  warn "只对新打开的终端生效，或 source $rc"
else
  warn "已跳过 shell rc 写入 (--skip-rc)"
fi

# 6. verify
step "验证"
if codex_ver="$(codex --version 2>&1)"; then
  ok "codex --version → $codex_ver"
else
  warn "codex --version 没跑通。可能 PATH 还没刷新——重新打开终端再试。"
fi

step "完成"
printf "
  CLI version  : %s
  Default model: %s
  Gateway      : %s
  Base URL     : %s
  Config       : %s
  Key (env)    : OPENAI_API_KEY = %s

下一步：
  1. 关掉这个终端，新开一个 (或 source rc)
  2. cd 到任何项目目录跑：codex
" "${codex_ver:-unknown}" "$DEFAULT_MODEL" "$PROVIDER_NAME" "$BASE_URL" "$conf" "$mask"
