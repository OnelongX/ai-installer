# OpenClaw 一键配 LiveToken

> [OpenClaw](https://openclaw.ai) 是 Peter Steinberger 那个原 `Clawdbot` 改名后的开源 AI 代理框架（把 Claude / GPT-4o / Gemini 等模型接到 WhatsApp / Telegram / iMessage 等消息平台）。

这一份脚本帮你把 OpenClaw 的默认模型 provider 设成 [LiveToken](https://livetoken.top)，模型直接用 Anthropic 兼容接口走过去。

---

## 直接用

PowerShell 里跑：

```powershell
# 交互式：脚本会让你贴 API Key
.\scripts\configure-openclaw.ps1
```

或者一行命令完成：

```powershell
.\scripts\configure-openclaw.ps1 -ApiKey 'sk-xxxxxx' -DefaultModel 'claude-sonnet-4-5'
```

执行策略被拦了就先：

```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
# 或一次性绕过
powershell -ExecutionPolicy Bypass -File .\scripts\configure-openclaw.ps1
```

## 它干了啥

1. **装** —— 检测 `openclaw` 命令；缺则 `npm i -g openclaw`（没装 Node 的话先跑 [Claude 安装器](../claude/) 补齐）
2. **写配置** —— 在 `%USERPROFILE%\.openclaw\openclaw.json` 写入 LiveToken provider：
   ```json5
   {
     models: {
       providers: {
         livetoken: {
           name: "LiveToken",
           baseUrl: "https://livetoken.top",
           compatibility: "anthropic",
           models: [
             { id: "claude-sonnet-4-5", name: "Claude Sonnet 4.5 (via LiveToken)" },
             { id: "claude-opus-4-5",   name: "Claude Opus 4.5 (via LiveToken)" },
             { id: "claude-haiku-4-5",  name: "Claude Haiku 4.5 (via LiveToken)" }
           ]
         }
       }
     },
     auth: {
       profiles: {
         "livetoken:default": {
           provider: "livetoken",
           mode: "api_key",
           keyRef: { source: "env", id: "LIVETOKEN_API_KEY" }
         }
       }
     },
     agents: {
       defaults: { model: { provider: "livetoken", id: "claude-sonnet-4-5" } }
     }
   }
   ```
   旧的 `openclaw.json` 自动备份成 `openclaw.json.bak.<时间戳>`。
3. **写 Key** —— `LIVETOKEN_API_KEY` 进 Windows 用户环境变量
4. **下一步** —— 关掉当前终端，新开一个跑 `openclaw agent run "hello"`

## 参数

| 参数 | 默认值 | 说明 |
|---|---|---|
| `-ApiKey` | （交互式） | LiveToken API Key |
| `-BaseUrl` | `https://livetoken.top` | 网关 URL（换私有部署时改） |
| `-DefaultModel` | `claude-sonnet-4-5` | 默认模型 id |
| `-SkipInstall` | `false` | 已装好的话跳过 npm install |
| `-NoEnvVar` | `false` | 不写 Windows 环境变量（适合 CI 之类的场景） |

## 验证

```powershell
# 新开一个 PowerShell 窗口
openclaw --version

# 看配置确实在
type "$env:USERPROFILE\.openclaw\openclaw.json"

# 跑一句
openclaw agent run "用一句话介绍你自己"
```

如果 LiveToken 那边能看到调用，且 OpenClaw 跑得动，就成了。

## 卸 / 还原

- **删配置**：`Remove-Item "$env:USERPROFILE\.openclaw\openclaw.json"`
- **回滚旧配置**：上一份备份在同目录 `*.bak.*`
- **清环境变量**：`[Environment]::SetEnvironmentVariable('LIVETOKEN_API_KEY', $null, 'User')`
- **卸 OpenClaw**：`npm uninstall -g openclaw`
