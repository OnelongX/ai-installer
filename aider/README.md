# Aider 一键配 LiveToken

> [Aider](https://aider.chat) 是最老牌的终端 AI 编码 Agent，Python 写的，跟 git 深度集成。底层走 [litellm](https://github.com/BerriAI/litellm)，所以任何 Anthropic / OpenAI 兼容网关都直接能用。

本脚本帮你把 Aider 配置成默认走 LiveToken 的 Anthropic 兼容接口，默认模型 `claude-sonnet-4-5`，弱模型 `claude-haiku-4-5`。

---

## 用

### Windows

```powershell
.\scripts\configure-aider.ps1                           # 交互式
.\scripts\configure-aider.ps1 -ApiKey 'sk-xxxxxx'
.\scripts\configure-aider.ps1 -ApiKey 'sk-xxxxxx' -DefaultModel 'anthropic/claude-opus-4-5'
```

### macOS / Linux / WSL

```bash
chmod +x scripts/configure-aider.sh
./scripts/configure-aider.sh                            # 交互式
./scripts/configure-aider.sh --api-key 'sk-xxxxxx'
./scripts/configure-aider.sh --api-key 'sk-xxxxxx' --model 'anthropic/claude-opus-4-5'
```

## 它干了啥

1. **装** —— 检测 `aider` 命令；缺则 `pip install -U aider-chat`（需要 Python 3.10+）
2. **写配置** —— `~/.aider.conf.yml`：
   ```yaml
   model: anthropic/claude-sonnet-4-5
   weak-model: anthropic/claude-haiku-4-5
   edit-format: diff
   auto-commits: true
   gitignore: true
   analytics: false
   ```
   旧的 conf 备份成 `.bak.<时间戳>`
3. **环境变量**：
   - `ANTHROPIC_API_KEY` ＝ 你的 LiveToken Key
   - `ANTHROPIC_API_BASE` ＝ `https://livetoken.top`
   - `LIVETOKEN_API_KEY` 也存一份（其他 ai-installer 工具会复用）
   
   Windows 走用户级环境变量；macOS / Linux 写到 `~/.zshrc` 或 `~/.bashrc`（用 marker 包裹，幂等）
4. **下一步** —— 新开终端，cd 到 git 仓库，跑 `aider`

## 参数

| PS1 | Bash | 默认 | 说明 |
|---|---|---|---|
| `-ApiKey` | `--api-key` | （交互式） | LiveToken Key |
| `-BaseUrl` | `--base-url` | `https://livetoken.top` | 私有部署时改 |
| `-DefaultModel` | `--model` | `anthropic/claude-sonnet-4-5` | 主模型（litellm 命名） |
| `-WeakModel` | `--weak-model` | `anthropic/claude-haiku-4-5` | 弱模型（用于 commit 信息等） |
| `-SkipInstall` | `--skip-install` | off | 已装好就跳过 pip |
| `-NoEnvVar` | `--no-rc` | off | 不写环境变量 |

## 卸 / 还原

- **删配置**：`rm ~/.aider.conf.yml`（备份还在 `.bak.*`）
- **清环境**：把 rc 里 `>>> ai-installer / aider / livetoken >>>` 这块整段删掉，Windows 用 `[Environment]::SetEnvironmentVariable('ANTHROPIC_API_KEY', $null, 'User')`
- **卸 Aider**：`pip uninstall aider-chat`

## 一些已知坑

- Aider 默认会发遥测，脚本里已经关了（`analytics: false`）
- 如果用 `pip install --user` 安装的，确保 `~/.local/bin`（Linux）或 `~/Library/Python/3.x/bin`（macOS）在 PATH 里
- `anthropic/...` 是 litellm 的命名空间约定，**不能写成裸 `claude-sonnet-4-5`**，否则 Aider 会去找 OpenAI 兼容端点
