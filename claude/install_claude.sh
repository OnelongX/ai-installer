#!/usr/bin/env bash
#
# install_claude.sh — 一行命令在 macOS / Linux / WSL 上把 Claude Code 装到位
#
# 做的事和 Windows 上的 Claude 安装器一一对位：
#   1. 检测 / 安装 Node.js (brew / apt / dnf / pacman / zypper / fnm 兜底)
#   2. npm i -g @anthropic-ai/claude-code
#   3. 写 ~/.claude/settings.json (LiveToken provider + claude-sonnet-4-5
#      + CLAUDE_CODE_ATTRIBUTION_HEADER=0 防 prefix cache 失效)
#   4. 把 ANTHROPIC_API_KEY + ANTHROPIC_BASE_URL 写进 ~/.zshrc / ~/.bashrc
#   5. 跑 claude --version 验证
#
# 用法：
#   ./install_claude.sh                                          # 交互式
#   ./install_claude.sh --api-key sk-ant-xxx
#   curl -fsSL https://raw.githubusercontent.com/OnelongX/ai-installer/main/claude/install_claude.sh | bash -s -- --api-key sk-ant-xxx

set -euo pipefail

API_KEY="${API_KEY:-}"
BASE_URL="https://livetoken.top"
DEFAULT_MODEL="claude-sonnet-4-6"
SMALL_FAST_MODEL="claude-haiku-4-5"
DEFAULT_EFFORT="high"
NPM_PACKAGE="@anthropic-ai/claude-code"
SKIP_NODE=0
SKIP_RC=0
NON_INTERACTIVE=0
KEEP_OAUTH=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --api-key)         API_KEY="$2"; shift 2 ;;
    --base-url)        BASE_URL="$2"; shift 2 ;;
    --model)           DEFAULT_MODEL="$2"; shift 2 ;;
    --skip-node)       SKIP_NODE=1; shift ;;
    --skip-rc)         SKIP_RC=1; shift ;;
    --keep-oauth)      KEEP_OAUTH=1; shift ;;
    --non-interactive) NON_INTERACTIVE=1; shift ;;
    -h|--help) sed -n '2,18p' "$0" | sed 's/^#\s\?//'; exit 0 ;;
    *) echo "未知参数: $1" >&2; exit 2 ;;
  esac
done

c=$'\033'; cyan="${c}[1;36m"; green="${c}[1;32m"; yellow="${c}[1;33m"; red="${c}[1;31m"; reset="${c}[0m"
step()  { printf "\n${cyan}==> %s${reset}\n" "$1"; }
ok()    { printf "    ${green}[ok]${reset} %s\n" "$1"; }
warn()  { printf "    ${yellow}[warn]${reset} %s\n" "$1"; }
fail()  { printf "    ${red}[fail]${reset} %s\n" "$1" >&2; }
has()   { command -v "$1" >/dev/null 2>&1; }

# ---------------------------------------------------------------------------
# 0. platform check
# ---------------------------------------------------------------------------
OS="$(uname -s)"
case "$OS" in
  Darwin|Linux) ;;
  *) fail "不支持的系统：$OS。本脚本面向 macOS / Linux / WSL；Windows 请用 Claude 安装器。"; exit 1 ;;
esac

# ---------------------------------------------------------------------------
# 1. ensure Node + npm
# ---------------------------------------------------------------------------
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
  else  # Linux
    if has apt-get; then
      step "apt-get install nodejs npm"
      if has curl; then
        curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash - && sudo apt-get install -y nodejs && installed=1
      else
        sudo apt-get update && sudo apt-get install -y nodejs npm && installed=1
      fi
    elif has dnf; then
      step "dnf install nodejs npm"
      sudo dnf install -y nodejs npm && installed=1
    elif has pacman; then
      step "pacman -S nodejs npm"
      sudo pacman -S --noconfirm nodejs npm && installed=1
    elif has zypper; then
      step "zypper install nodejs npm"
      sudo zypper install -y nodejs npm && installed=1
    fi
  fi

  if [[ $installed -ne 1 ]]; then
    warn "包管理器装 Node 没成。回落到 fnm。"
    if ! has fnm; then
      curl -fsSL https://fnm.vercel.app/install | bash
      # shellcheck disable=SC1090
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
    fail "Node 装完了还是找不到。重新打开终端再试，或先手动装 Node 20+。"
    exit 1
  fi
  ok "Node.js $(node -v) / npm $(npm -v)"
fi

# Sanity check Node version
node_major=$(node -v | sed -E 's/v([0-9]+)\..*/\1/')
if [[ -n "$node_major" && "$node_major" -lt 20 ]]; then
  warn "Node $(node -v) 比 v20 老，Claude Code 要求至少 Node 20，后面 npm 装可能 fail。"
fi

# ---------------------------------------------------------------------------
# 2. resolve API key
# ---------------------------------------------------------------------------
step "取 LiveToken API Key"
if [[ -z "$API_KEY" ]]; then
  API_KEY="${LIVETOKEN_API_KEY:-${ANTHROPIC_API_KEY:-}}"
  [[ -n "$API_KEY" ]] && warn "复用环境变量里的 LIVETOKEN_API_KEY / ANTHROPIC_API_KEY"
fi
if [[ -z "$API_KEY" ]]; then
  if [[ $NON_INTERACTIVE -eq 1 ]]; then
    fail "非交互模式下必须传 --api-key。"
    exit 1
  fi
  printf "请粘贴 LiveToken API Key (注册: https://livetoken.top): "
  stty -echo; read -r API_KEY; stty echo; printf "\n"
fi
API_KEY="${API_KEY// /}"
[[ -z "$API_KEY" ]] && { fail "API Key 为空"; exit 1; }
mask="***"
[[ ${#API_KEY} -ge 8 ]] && mask="${API_KEY:0:2}***${API_KEY: -4}"
ok "Key 已读取: $mask"

# ---------------------------------------------------------------------------
# 3. install Claude Code CLI
# ---------------------------------------------------------------------------
step "安装 $NPM_PACKAGE"
if has claude; then
  cur="$(claude --version 2>/dev/null | head -1 || true)"
  warn "已检测到 claude${cur:+: $cur}；npm 会升级到最新版"
fi
npm install -g "$NPM_PACKAGE"
ok "npm i -g $NPM_PACKAGE 完成"

# ---------------------------------------------------------------------------
# 3.5 clear stale Anthropic OAuth credentials (so env vars actually win)
# ---------------------------------------------------------------------------
home_dir="${HOME:-/}"
conf_dir="$home_dir/.claude"
oauth_file="$conf_dir/.credentials.json"
mkdir -p "$conf_dir"

step "检查官方 OAuth 凭据"
if [[ -f "$oauth_file" ]]; then
  if [[ $KEEP_OAUTH -eq 1 ]]; then
    warn "检测到 $oauth_file 存在；--keep-oauth 指定，保留它（但 LiveToken 网关可能失效）"
  else
    stamp="$(date +%Y%m%d-%H%M%S)"
    mv "$oauth_file" "$oauth_file.bak.$stamp"
    ok "已备份并移除 → $oauth_file.bak.$stamp"
    warn "原因：Claude Code 在 .credentials.json 存在时优先用官方 OAuth，会忽略 ANTHROPIC_API_KEY/ANTHROPIC_BASE_URL。"
  fi
else
  ok "未发现官方 OAuth 凭据，无需清理"
fi

# ---------------------------------------------------------------------------
# 4. write ~/.claude/settings.json
# ---------------------------------------------------------------------------
step "写入 ~/.claude/settings.json"
conf="$conf_dir/settings.json"
if [[ -f "$conf" ]]; then
  stamp="$(date +%Y%m%d-%H%M%S)"
  cp "$conf" "$conf.bak.$stamp"
  ok "已备份 → $conf.bak.$stamp"
fi

cat > "$conf" <<JSON
{
  "env": {
    "ANTHROPIC_BASE_URL": "$BASE_URL",
    "ANTHROPIC_MODEL": "$DEFAULT_MODEL",
    "ANTHROPIC_SMALL_FAST_MODEL": "$SMALL_FAST_MODEL",
    "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC": "1",
    "CLAUDE_CODE_ATTRIBUTION_HEADER": "0"
  },
  "model": "$DEFAULT_MODEL",
  "effortLevel": "$DEFAULT_EFFORT",
  "permissions": { "defaultMode": "acceptEdits" },
  "autoUpdaterStatus": "enabled",
  "includeCoAuthoredBy": false
}
JSON
ok "已写入 $conf"

# ---------------------------------------------------------------------------
# 5. persist ANTHROPIC_API_KEY in shell rc
# ---------------------------------------------------------------------------
if [[ $SKIP_RC -eq 0 ]]; then
  step "写入环境变量到 shell rc"
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
  marker="# >>> ai-installer / claude / livetoken >>>"
  end="# <<< ai-installer / claude / livetoken <<<"
  if grep -qF "$marker" "$rc"; then
    awk -v m="$marker" -v e="$end" '$0==m{skip=1;next} skip && $0==e{skip=0;next} !skip{print}' "$rc" > "$rc.tmp" && mv "$rc.tmp" "$rc"
  fi
  {
    printf "\n%s\n" "$marker"
    printf "export ANTHROPIC_API_KEY=%q\n" "$API_KEY"
    printf "export ANTHROPIC_BASE_URL=%q\n" "$BASE_URL"
    printf "export LIVETOKEN_API_KEY=%q\n" "$API_KEY"
    printf "%s\n" "$end"
  } >> "$rc"
  ok "已在 $rc 写入 ANTHROPIC_API_KEY=$mask + ANTHROPIC_BASE_URL=$BASE_URL"
  warn "只对新打开的终端生效，或 source $rc"
else
  warn "已跳过 shell rc 写入 (--skip-rc)。运行 claude 前请手动 export ANTHROPIC_API_KEY=…"
fi

# ---------------------------------------------------------------------------
# 6. verify
# ---------------------------------------------------------------------------
step "验证"
if claude_ver="$(claude --version 2>&1)"; then
  ok "claude --version → $claude_ver"
else
  warn "claude --version 没跑通。可能 PATH 还没刷新——重新打开终端再试。"
fi

step "完成"
printf "
  CLI version  : %s
  Default model: %s
  Base URL     : %s
  Config       : %s
  Key (env)    : ANTHROPIC_API_KEY = %s

下一步：
  1. 关掉这个终端，新开一个 (或 source rc)
  2. cd 到任何项目目录跑：claude
  3. 余额/用量看 https://livetoken.top 控制台
" "${claude_ver:-unknown}" "$DEFAULT_MODEL" "$BASE_URL" "$conf" "$mask"
