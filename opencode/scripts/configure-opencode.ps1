<#
  configure-opencode.ps1 — 一键把 opencode (sst) 接到 LiveToken (Windows)

  做的事：
    1. 检测 opencode；缺则 npm i -g opencode-ai
    2. 取 LiveToken API Key
    3. 备份并写 %APPDATA%\opencode\opencode.json
    4. 写 ANTHROPIC_API_KEY + ANTHROPIC_BASE_URL 到 Windows 用户环境变量
       （这两个 env opencode 和 Claude Code 共用，装过 Claude 安装器的可直接 -SkipEnvVar）

  用法：
    .\configure-opencode.ps1
    .\configure-opencode.ps1 -ApiKey 'sk-xxx' -DefaultModel 'anthropic/claude-opus-4-5'
#>

[CmdletBinding()]
param(
  [string]$ApiKey,
  [string]$BaseUrl = 'https://livetoken.top',
  [string]$DefaultModel = 'anthropic/claude-sonnet-4-5',
  [switch]$SkipInstall,
  [switch]$NoEnvVar
)

$ErrorActionPreference = 'Stop'

function Write-Step { param($m) Write-Host ''; Write-Host "==> $m" -ForegroundColor Cyan }
function Write-Ok   { param($m) Write-Host "    [ok] $m"   -ForegroundColor Green }
function Write-Warn2{ param($m) Write-Host "    [warn] $m" -ForegroundColor Yellow }
function Write-Fail { param($m) Write-Host "    [fail] $m" -ForegroundColor Red }
function Has-Cmd    { param($n) [bool](Get-Command $n -ErrorAction SilentlyContinue) }

# 1. ensure opencode
Write-Step '检查 opencode'
if (Has-Cmd 'opencode' -and -not $SkipInstall) {
  $ver = & opencode --version 2>$null
  Write-Ok "已检测到 opencode${(if($ver){`": ${($ver -join ' ').Trim()}`"}else{''})}"
} elseif (-not $SkipInstall) {
  if (-not (Has-Cmd 'npm')) {
    Write-Fail '没有 npm。先跑 ai-installer 的 Claude 安装器装 Node，或者 winget install OpenJS.NodeJS.LTS'
    exit 1
  }
  Write-Warn2 '未检测到 opencode 命令，尝试 npm i -g opencode-ai …'
  & npm install -g opencode-ai
  if ($LASTEXITCODE -ne 0) { Write-Fail 'npm 装 opencode-ai 失败'; exit 1 }
  Write-Ok '已 npm install -g opencode-ai'
}

# 2. resolve key
Write-Step '取 LiveToken API Key'
if (-not $ApiKey) {
  $ApiKey = [Environment]::GetEnvironmentVariable('LIVETOKEN_API_KEY', 'User')
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

# 3. write opencode.json
Write-Step '写入 opencode.json'
$confDir = Join-Path $env:APPDATA 'opencode'
$confPath = Join-Path $confDir 'opencode.json'
if (-not (Test-Path $confDir)) { New-Item -Path $confDir -ItemType Directory -Force | Out-Null }
if (Test-Path $confPath) {
  $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
  Copy-Item $confPath "$confPath.bak.$stamp"
  Write-Ok "已备份 → $confPath.bak.$stamp"
}

$config = [ordered]@{
  '$schema' = 'https://opencode.ai/config.json'
  model = $DefaultModel
  provider = [ordered]@{
    anthropic = [ordered]@{
      options = [ordered]@{
        apiKey  = '{env:ANTHROPIC_API_KEY}'
        baseURL = '{env:ANTHROPIC_BASE_URL}'
        timeout = 300000
      }
    }
  }
}
$json = $config | ConvertTo-Json -Depth 10
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[IO.File]::WriteAllText($confPath, $json, $utf8NoBom)
Write-Ok "已写入 $confPath"

# 4. env vars
if (-not $NoEnvVar) {
  Write-Step '写入 ANTHROPIC_API_KEY + ANTHROPIC_BASE_URL'
  [Environment]::SetEnvironmentVariable('ANTHROPIC_API_KEY',  $ApiKey,  'User')
  [Environment]::SetEnvironmentVariable('ANTHROPIC_BASE_URL', $BaseUrl, 'User')
  [Environment]::SetEnvironmentVariable('LIVETOKEN_API_KEY',  $ApiKey,  'User')
  Write-Ok "ANTHROPIC_API_KEY = $mask"
  Write-Ok "ANTHROPIC_BASE_URL = $BaseUrl"
  Write-Warn2 '只对新打开的终端生效。'
}

Write-Step '完成'
Write-Host ''
Write-Host "  Default model: $DefaultModel" -ForegroundColor White
Write-Host "  Base URL     : $BaseUrl"      -ForegroundColor White
Write-Host "  Config       : $confPath"     -ForegroundColor White
Write-Host ''
Write-Host '下一步：' -ForegroundColor Cyan
Write-Host '  1. 新开 PowerShell'
Write-Host '  2. 跑：opencode'
Write-Host '  3. 切模型：在 opencode TUI 里 /models 或改 opencode.json 的 model 字段'
