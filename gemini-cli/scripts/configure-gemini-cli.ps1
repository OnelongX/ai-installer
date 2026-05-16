<#
  configure-gemini-cli.ps1 — 一键把 Google Gemini CLI 接到 LiveToken (Windows)

  做的事：
    1. 检测 gemini 命令；缺则 npm i -g @google/gemini-cli
    2. 取 LiveToken API Key
    3. 写 GEMINI_API_KEY + GOOGLE_GEMINI_BASE_URL 到 Windows 用户环境变量
    4. 写 settings.json 到 ~/.gemini/settings.json，关掉 Cloud Auth 让 env 生效

  已知坑：
    Gemini CLI 在某些版本（含 v0.21.x）会忽略 GOOGLE_GEMINI_BASE_URL
    如果已经登过 Google Cloud。脚本会同时清理 cached auth 提示。

  用法：
    .\configure-gemini-cli.ps1
    .\configure-gemini-cli.ps1 -ApiKey 'sk-xxx'
#>

[CmdletBinding()]
param(
  [string]$ApiKey,
  [string]$BaseUrl = 'https://livetoken.top',
  [string]$DefaultModel = 'gemini-2.5-pro',
  [switch]$SkipInstall,
  [switch]$NoEnvVar
)

$ErrorActionPreference = 'Stop'

function Write-Step { param($m) Write-Host ''; Write-Host "==> $m" -ForegroundColor Cyan }
function Write-Ok   { param($m) Write-Host "    [ok] $m"   -ForegroundColor Green }
function Write-Warn2{ param($m) Write-Host "    [warn] $m" -ForegroundColor Yellow }
function Write-Fail { param($m) Write-Host "    [fail] $m" -ForegroundColor Red }
function Has-Cmd    { param($n) [bool](Get-Command $n -ErrorAction SilentlyContinue) }

# 1. ensure gemini
Write-Step '检查 Gemini CLI'
if (Has-Cmd 'gemini' -and -not $SkipInstall) {
  $ver = & gemini --version 2>$null
  Write-Ok "已检测到 gemini${(if($ver){`": ${($ver -join ' ').Trim()}`"}else{''})}"
} elseif (-not $SkipInstall) {
  if (-not (Has-Cmd 'npm')) {
    Write-Fail '没有 npm。先跑 ai-installer 的 Claude 安装器装 Node。'
    exit 1
  }
  Write-Warn2 '未检测到 gemini 命令，尝试 npm i -g @google/gemini-cli …'
  & npm install -g '@google/gemini-cli'
  if ($LASTEXITCODE -ne 0) { Write-Fail 'npm 装 gemini-cli 失败'; exit 1 }
  Write-Ok '已 npm install -g @google/gemini-cli'
}

# 2. resolve key
Write-Step '取 LiveToken API Key'
if (-not $ApiKey) {
  $ApiKey = [Environment]::GetEnvironmentVariable('LIVETOKEN_API_KEY', 'User')
  if (-not $ApiKey) { $ApiKey = [Environment]::GetEnvironmentVariable('GEMINI_API_KEY', 'User') }
  if (-not $ApiKey) { $ApiKey = [Environment]::GetEnvironmentVariable('ANTHROPIC_API_KEY', 'User') }
  if ($ApiKey) { Write-Warn2 '复用已有的环境变量里的 Key' }
}
if (-not $ApiKey) {
  $secure = Read-Host '请粘贴 LiveToken API Key (注册: https://livetoken.top)' -AsSecureString
  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try { $ApiKey = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
}
$ApiKey = $ApiKey.Trim()
if (-not $ApiKey) { Write-Fail 'API Key 为空'; exit 1 }

$mask = if ($ApiKey.Length -ge 8) { "$($ApiKey.Substring(0,2))***$($ApiKey.Substring($ApiKey.Length-4))" } else { '***' }
Write-Ok "Key 已读取: $mask"

# 3. settings.json
Write-Step '写入 ~/.gemini/settings.json'
$home_dir = $env:USERPROFILE
$confDir  = Join-Path $home_dir '.gemini'
$confPath = Join-Path $confDir 'settings.json'
if (-not (Test-Path $confDir)) { New-Item -Path $confDir -ItemType Directory -Force | Out-Null }
if (Test-Path $confPath) {
  $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
  Copy-Item $confPath "$confPath.bak.$stamp"
  Write-Ok "已备份 → $confPath.bak.$stamp"
}

$settings = [ordered]@{
  selectedAuthType = 'gemini-api-key'
  model            = $DefaultModel
  theme            = 'Default'
}
$json = $settings | ConvertTo-Json -Depth 10
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[IO.File]::WriteAllText($confPath, $json, $utf8NoBom)
Write-Ok "已写入 $confPath (selectedAuthType=gemini-api-key)"

# 4. env vars
if (-not $NoEnvVar) {
  Write-Step '写入 GEMINI_API_KEY + GOOGLE_GEMINI_BASE_URL'
  [Environment]::SetEnvironmentVariable('GEMINI_API_KEY',         $ApiKey,  'User')
  [Environment]::SetEnvironmentVariable('GOOGLE_GEMINI_BASE_URL', $BaseUrl, 'User')
  [Environment]::SetEnvironmentVariable('LIVETOKEN_API_KEY',      $ApiKey,  'User')
  Write-Ok "GEMINI_API_KEY = $mask"
  Write-Ok "GOOGLE_GEMINI_BASE_URL = $BaseUrl"
  Write-Warn2 '只对新打开的终端生效。'
}

Write-Step '完成'
Write-Host ''
Write-Host "  Default model: $DefaultModel"     -ForegroundColor White
Write-Host "  Base URL     : $BaseUrl"          -ForegroundColor White
Write-Host "  Config       : $confPath"         -ForegroundColor White
Write-Host "  Auth         : api-key (绕开 Google Cloud login 缓存)" -ForegroundColor White
Write-Host ''
Write-Host '下一步：' -ForegroundColor Cyan
Write-Host '  1. 新开 PowerShell 让环境变量生效'
Write-Host '  2. 跑：gemini'
Write-Host '  3. 如果还跑去 google.com 那条 URL，删 ~/.gemini/oauth_creds.json 再试一次'
