#!/usr/bin/env bash
# configure-gemini-cli.sh — 一键把 Google Gemini CLI 接到 LiveToken (macOS / Linux / WSL)

set -euo pipefail

API_KEY="${API_KEY:-}"
BASE_URL="https://livetoken.top"
DEFAULT_MODEL="gemini-2.5-pro"
SKIP_INSTALL=0
NO_RC=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --api-key)      API_KEY="$2"; shift 2 ;;
    --base-url)     BASE_URL="$2"; shift 2 ;;
    --model)        DEFAULT_MODEL="$2"; shift 2 ;;
    --skip-install) SKIP_INSTALL=1; shift ;;
    --no-rc)        NO_RC=1; shift ;;
    -h|--help) head -n 3 "$0" | sed 's/^#//;s/^!.*//'; exit 0 ;;
    *) echo "未知参数: $1" >&2; exit 2 ;;
  esac
done

c=$'\033'; cyan="${c}[1;36m"; green="${c}[1;32m"; yellow="${c}[1;33m"; red="${c}[1;31m"; reset="${c}[0m"
step()  { printf "\n${cyan}==> %s${reset}\n" "$1"; }
ok()    { printf "    ${green}[ok]${reset} %s\n" "$1"; }
warn()  { printf "    ${yellow}[warn]${reset} %s\n" "$1"; }
fail()  { printf "    ${red}[fail]${reset} %s\n" "$1" >&2; }

# 1. ensure gemini
step "检查 Gemini CLI"
if command -v gemini >/dev/null 2>&1; then
  ver="$(gemini --version 2>/dev/null | head -1 || true)"
  ok "已检测到 gemini${ver:+: $ver}"
elif [[ $SKIP_INSTALL -eq 1 ]]; then
  warn "未检测到 gemini 命令（跳过安装由 --skip-install 指定）"
else
  if ! command -v npm >/dev/null 2>&1; then
    fail "没有 npm。macOS: brew install node；Debian/Ubuntu: apt install nodejs npm"
    exit 1
  fi
  warn "未检测到 gemini 命令，尝试 npm i -g @google/gemini-cli …"
  npm install -g '@google/gemini-cli'
  ok "已 npm install -g @google/gemini-cli"
fi

# 2. resolve key
step "取 LiveToken API Key"
if [[ -z "$API_KEY" ]]; then
  API_KEY="${LIVETOKEN_API_KEY:-${GEMINI_API_KEY:-${ANTHROPIC_API_KEY:-}}}"
  [[ -n "$API_KEY" ]] && warn "复用已有的环境变量里的 Key"
fi
if [[ -z "$API_KEY" ]]; then
  printf "请粘贴 LiveToken API Key (注册: https://livetoken.top): "
  stty -echo; read -r API_KEY; stty echo; printf "\n"
fi
API_KEY="${API_KEY// /}"
[[ -z "$API_KEY" ]] && { fail "API Key 为空"; exit 1; }

mask="***"
[[ ${#API_KEY} -ge 8 ]] && mask="${API_KEY:0:2}***${API_KEY: -4}"
ok "Key 已读取: $mask"

# 3. write settings.json
step "写入 ~/.gemini/settings.json"
home_dir="${HOME:-/}"
conf_dir="$home_dir/.gemini"
conf="$conf_dir/settings.json"
mkdir -p "$conf_dir"
if [[ -f "$conf" ]]; then
  stamp="$(date +%Y%m%d-%H%M%S)"
  cp "$conf" "$conf.bak.$stamp"
  ok "已备份 → $conf.bak.$stamp"
fi

cat > "$conf" <<JSON
{
  "selectedAuthType": "gemini-api-key",
  "model": "$DEFAULT_MODEL",
  "theme": "Default"
}
JSON
ok "已写入 $conf (selectedAuthType=gemini-api-key)"

# Drop OAuth cache to ensure env vars take effect — Gemini CLI bug #15430
oauth_file="$home_dir/.gemini/oauth_creds.json"
if [[ -f "$oauth_file" ]]; then
  cp "$oauth_file" "$oauth_file.bak.$(date +%Y%m%d-%H%M%S)"
  rm -f "$oauth_file"
  warn "已清掉 cached Google Cloud auth (备份在 $oauth_file.bak.*)"
fi

# 4. env vars
if [[ $NO_RC -eq 0 ]]; then
  step "写入 GEMINI_API_KEY + GOOGLE_GEMINI_BASE_URL 到 shell rc"
  rc=""
  case "${SHELL:-}" in
    */zsh)  rc="$home_dir/.zshrc" ;;
    */bash) rc="$home_dir/.bashrc" ;;
    *)
      if [[ -f "$home_dir/.zshrc" ]]; then rc="$home_dir/.zshrc"
      elif [[ -f "$home_dir/.bashrc" ]]; then rc="$home_dir/.bashrc"
      elif [[ "$(uname)" == "Darwin" ]]; then rc="$home_dir/.zshrc"
      else rc="$home_dir/.bashrc"
      fi
      ;;
  esac
  touch "$rc"
  marker="# >>> ai-installer / gemini-cli / livetoken >>>"
  end="# <<< ai-installer / gemini-cli / livetoken <<<"
  if grep -qF "$marker" "$rc"; then
    awk -v m="$marker" -v e="$end" '$0==m{skip=1;next} skip && $0==e{skip=0;next} !skip{print}' "$rc" > "$rc.tmp" && mv "$rc.tmp" "$rc"
  fi
  {
    printf "\n%s\n" "$marker"
    printf "export GEMINI_API_KEY=%q\n" "$API_KEY"
    printf "export GOOGLE_GEMINI_BASE_URL=%q\n" "$BASE_URL"
    printf "export LIVETOKEN_API_KEY=%q\n" "$API_KEY"
    printf "%s\n" "$end"
  } >> "$rc"
  ok "已在 $rc 写入 env vars"
  warn "只对新打开的终端生效，或 source $rc"
fi

step "完成"
printf "
  Default model: %s
  Base URL     : %s
  Config       : %s
  Auth         : api-key (绕开 Google Cloud login 缓存)

下一步：
  1. 新开终端 (或 source rc)
  2. 跑：gemini
  3. 如果还跑去 google.com 那条 URL，删 ~/.gemini/oauth_creds.json 再试一次
" "$DEFAULT_MODEL" "$BASE_URL" "$conf"
