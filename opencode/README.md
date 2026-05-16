# opencode 一键配 LiveToken

> [opencode](https://opencode.ai) 是 SST 团队出的开源 Claude Code 替代品，TUI 体验和 Claude Code 几乎对齐，但完全开源、支持自定义 provider。

本脚本帮你把 opencode 的默认 provider 设成 LiveToken（Anthropic 兼容），默认模型 `anthropic/claude-sonnet-4-5`。

---

## 用

### Windows

```powershell
.\scripts\configure-opencode.ps1
.\scripts\configure-opencode.ps1 -ApiKey 'sk-xxx' -DefaultModel 'anthropic/claude-opus-4-5'
```

### macOS / Linux / WSL

```bash
chmod +x scripts/configure-opencode.sh
./scripts/configure-opencode.sh
./scripts/configure-opencode.sh --api-key 'sk-xxx' --model 'anthropic/claude-opus-4-5'
```

## 它干了啥

1. **装** —— 检测 `opencode`；缺则 `npm i -g opencode-ai`
2. **写配置** —— 
   - Windows: `%APPDATA%\opencode\opencode.json`
   - macOS / Linux: `~/.config/opencode/opencode.json`
   
   生成的内容：
   ```json
   {
     "$schema": "https://opencode.ai/config.json",
     "model": "anthropic/claude-sonnet-4-5",
     "provider": {
       "anthropic": {
         "options": {
           "apiKey": "{env:ANTHROPIC_API_KEY}",
           "baseURL": "{env:ANTHROPIC_BASE_URL}",
           "timeout": 300000
         }
       }
     }
   }
   ```
   旧 conf 备份成 `.bak.<时间戳>`
3. **环境变量** —— `ANTHROPIC_API_KEY` + `ANTHROPIC_BASE_URL` + `LIVETOKEN_API_KEY` 三个一起写
4. **下一步** —— 新开终端跑 `opencode`

## 跟 Claude 安装器共用环境变量

如果你已经跑过 [Claude 安装器](../claude/)，opencode 直接就能用：
两边都读 `ANTHROPIC_API_KEY` + `ANTHROPIC_BASE_URL`，不会冲突。

```bash
# 已经装过 Claude？只需要拉 opencode + 写 opencode.json：
./scripts/configure-opencode.sh --skip-install --no-rc
```

或 PowerShell：

```powershell
.\scripts\configure-opencode.ps1 -SkipInstall -NoEnvVar
```

## 参数

| PS1 | Bash | 默认 | 说明 |
|---|---|---|---|
| `-ApiKey` | `--api-key` | 交互式 | LiveToken Key |
| `-BaseUrl` | `--base-url` | `https://livetoken.top` | 私有部署时改 |
| `-DefaultModel` | `--model` | `anthropic/claude-sonnet-4-5` | provider/model id |
| `-SkipInstall` | `--skip-install` | off | 跳过 npm 装 |
| `-NoEnvVar` | `--no-rc` | off | 不写环境变量 |

## 卸 / 还原

- **删配置**：删对应路径下的 `opencode.json`（备份 `.bak.*` 还在）
- **卸 opencode**：`npm uninstall -g opencode-ai`
- **清环境**：参考 [aider/README.md](../aider/README.md#卸--还原) 同样的操作

## 注意

- opencode 模型名走 `provider/model` 格式（跟 litellm 类似），所以是 `anthropic/claude-sonnet-4-5` 而不是裸 `claude-sonnet-4-5`
- 在 TUI 里按 `/models` 可以临时切模型
- 用 `OPENCODE_MODEL` 环境变量也能临时覆盖默认 model
