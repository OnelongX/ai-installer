# Google Gemini CLI 一键配 LiveToken

> [Gemini CLI](https://github.com/google-gemini/gemini-cli) 是 Google 官方出的 Gemini 终端工具。本脚本把它接到 LiveToken 的 Gemini 兼容端点，跳过 Google Cloud OAuth 流程。

---

## 用

### Windows

```powershell
.\scripts\configure-gemini-cli.ps1
.\scripts\configure-gemini-cli.ps1 -ApiKey 'sk-xxx' -DefaultModel 'gemini-2.5-flash'
```

### macOS / Linux / WSL

```bash
chmod +x scripts/configure-gemini-cli.sh
./scripts/configure-gemini-cli.sh
./scripts/configure-gemini-cli.sh --api-key 'sk-xxx' --model 'gemini-2.5-flash'
```

## 它干了啥

1. **装** —— `npm i -g @google/gemini-cli`
2. **写 `~/.gemini/settings.json`** —— 关键点：
   ```json
   {
     "selectedAuthType": "gemini-api-key",
     "model": "gemini-2.5-pro",
     "theme": "Default"
   }
   ```
   `selectedAuthType: gemini-api-key` 强制走 API Key 路径，**绕过 Google Cloud OAuth 缓存**。这是 [issue #15430](https://github.com/google-gemini/gemini-cli/issues/15430) 的 workaround —— 否则 v0.21.x 会忽略 `GOOGLE_GEMINI_BASE_URL`。
3. **清 OAuth 缓存** —— 如果存在 `~/.gemini/oauth_creds.json`，备份后删除（防止它强制走 Google 官方端点）
4. **环境变量**：
   - `GEMINI_API_KEY` ＝ 你的 LiveToken Key
   - `GOOGLE_GEMINI_BASE_URL` ＝ `https://livetoken.top`
   - `LIVETOKEN_API_KEY` 顺手存一份
5. **下一步** —— 新开终端跑 `gemini`

## 参数

| PS1 | Bash | 默认 | 说明 |
|---|---|---|---|
| `-ApiKey` | `--api-key` | 交互式 | LiveToken Key |
| `-BaseUrl` | `--base-url` | `https://livetoken.top` | 网关 URL |
| `-DefaultModel` | `--model` | `gemini-2.5-pro` | 默认模型 |
| `-SkipInstall` | `--skip-install` | off | 已装好跳过 npm |
| `-NoEnvVar` | `--no-rc` | off | 不写环境变量 |

## 已知坑

- **v0.21.x 在某些情况下仍然忽略 `GOOGLE_GEMINI_BASE_URL`**：如果跑 `gemini` 时还看到去 `generativelanguage.googleapis.com`，先确认：
  1. `~/.gemini/oauth_creds.json` 已经被删掉
  2. settings.json 里 `selectedAuthType` 是 `gemini-api-key`
  3. 当前 shell 里 `echo $GEMINI_API_KEY` 有值（新开 shell 才生效）

- **`--proxy` flag 是另一回事**：那个是给 HTTPS 代理用的（外发流量走代理），不能用来改 base URL。

- **API path 写死 `v1beta`**：[issue #16173](https://github.com/google-gemini/gemini-cli/issues/16184)。LiveToken 那边的 Gemini 路径要兼容 `v1beta` 才行。

## 卸 / 还原

- **删配置**：`rm ~/.gemini/settings.json`（备份 `.bak.*` 还在）
- **回滚 OAuth**：把 `oauth_creds.json.bak.*` 重命名回 `oauth_creds.json`
- **卸 Gemini CLI**：`npm uninstall -g @google/gemini-cli`
