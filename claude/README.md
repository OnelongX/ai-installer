# Claude 安装器 · ai-installer

一个 Windows 桌面工具，零配置帮你在本机装好 [Claude Code CLI](https://docs.anthropic.com/claude/docs/claude-code) **和 Claude Desktop**，并接入 [SolaEon](https://ai-api.solaeon.com)（默认）或 [LiveToken](https://livetoken.top/) 网关。

![release](https://img.shields.io/badge/release-0.1.6-blue) ![platform](https://img.shields.io/badge/platform-Windows%2010%2B-lightgrey) ![electron](https://img.shields.io/badge/electron-35-47848f)

---

## 它会替你做什么

| 步骤 | 内容 |
|---|---|
| ① 检测 | 检查 Node.js、Claude Code CLI、`~/.claude/settings.json` 是否就位 |
| ② 装 Node | 缺则用 `winget install OpenJS.NodeJS.LTS` 自动装上 |
| ③ 装 CLI | `npm i -g @anthropic-ai/claude-code` |
| ④ 验证网关 | 写配置前先 GET `网关/v1/models`，7 个模型缺一个就报错停 |
| ⑤ 写 CLI 配置 | `~/.claude/settings.json`：`ANTHROPIC_AUTH_TOKEN` + 7 模型白名单 + tier 默认 |
| ⑥ 写 Desktop 配置 | `HKCU\Software\Policies\Claude` 托管配置，桌面版菜单出 7 模型 + 3 个 1M |
| ⑦ 验证 | `claude --version` 跑通即成功 |

**模型服务网关**（API Key 页选）：SolaEon（默认，`https://ai-api.solaeon.com`）或 LiveToken（`https://livetoken.top`）。两者都是 HTTPS —— Claude 只接受 HTTPS 网关。

所有失败步骤都能单独**重试**，关掉重开还能从上次失败处**继续**。

---

## 下载

最新版本：[Releases 页](https://github.com/OnelongX/ai-installer/releases/latest)

| 类型 | 文件 | 适用场景 |
|---|---|---|
| 便携版 | [`Claude-Installer-Portable-0.1.6.exe`](https://github.com/OnelongX/ai-installer/releases/download/v0.1.6/Claude-Installer-Portable-0.1.6.exe) | 双击即用，不写注册表 |
| 安装包 | [`Claude-Installer-Setup-0.1.6.exe`](https://github.com/OnelongX/ai-installer/releases/download/v0.1.6/Claude-Installer-Setup-0.1.6.exe) | 标准 NSIS 安装到 Program Files，带桌面快捷方式 |

## macOS / Linux / WSL

没 GUI，但有一个 bash 脚本走完全一样的流程（含 v0.1.3 那条 `CLAUDE_CODE_ATTRIBUTION_HEADER=0` 修复）：

```bash
# 在线一行（强烈建议先读一遍内容再 pipe 给 bash）：
curl -fsSL https://raw.githubusercontent.com/OnelongX/ai-installer/main/claude/install_claude.sh \
  | bash -s -- --api-key sk-ant-xxx

# 或者：clone 后执行
git clone https://github.com/OnelongX/ai-installer.git
cd ai-installer/claude
chmod +x install_claude.sh
./install_claude.sh                            # 交互式
./install_claude.sh --api-key sk-ant-xxx
./install_claude.sh --api-key sk-ant-xxx --model claude-opus-4-5
```

Node 缺失时脚本会按 `brew → apt/dnf/pacman/zypper → fnm` 顺序自动装。`@anthropic-ai/claude-code` 装好后写 `~/.claude/settings.json`，把 `ANTHROPIC_API_KEY` 写进 `~/.zshrc` 或 `~/.bashrc`（marker 包裹，幂等），最后跑 `claude --version` 验证。

> 文件未做代码签名，Windows SmartScreen 第一次会弹"未识别的应用"，点"更多信息 → 仍要运行"即可。

---

## 使用教程

### 1. 准备一把 LiveToken Key

去 [https://livetoken.top](https://livetoken.top) 注册并生成一把 Key，形如 `sk-ant-xxx...` 或 `sk-xxx...`。

### 2. 启动安装器，输入 API Key

双击便携版 `.exe` 或安装后从桌面启动。进入欢迎页 → 在「API Key」输入框粘贴你的 LiveToken Key（以 `sk-` 开头），点"继续"。

![输入 API Key](docs/screenshots/02-api-key-filled.png)

> 如果之前装过，安装器会自动检测到已有 Key，可以直接复用。

### 3. 查看环境检测

下一页安装器会自检本机环境，列出系统、Node.js、Claude Code CLI、配置文件 4 项的状态。**绿色"已满足"**表示无需处理；其余会标成"自动修复"，由后面的安装步骤补齐。

![环境检测](docs/screenshots/03-detection.png)

确认无误后点"继续到安装计划"。

### 4. 确认安装计划

根据上一步的检测结果，安装器会动态生成最少必要的任务列表 —— 已装好的不会重复跑。

![安装计划](docs/screenshots/04-plan.png)

点右下角"开始安装"启动全自动流程：

- 装 Node 用 `winget`（首次需要 UAC 提权，弹出来允许即可）
- 装 Claude Code CLI 用 `npm i -g @anthropic-ai/claude-code`，国内网络可能要 1–3 分钟
- 写配置和环境变量是秒级
- 最后跑一次 `claude --version` 验证

### 5. 执行过程

执行页会实时滚动每条命令的输出。中间任何一步失败，UI 会标红那一行，点"重试当前步骤"就能从失败点恢复。

![安装执行](docs/screenshots/05-execution.png)

### 6. 完成

成功后能看到 Claude Code CLI 版本号、配置文件路径、API Key 掩码，以及一张 LiveToken 控制台入口卡。

![安装完成](docs/screenshots/06-complete.png)

**新开一个 PowerShell / Terminal** 跑：

```powershell
claude --version
claude
```

显示版本号并能进 Claude Code REPL 就成了。

> 注意：环境变量是写到"用户级"，**当前已打开的终端窗口看不到**新值，必须**新开一个**。

---

## 默认配置长啥样

安装完成后 `%USERPROFILE%\.claude\settings.json`（Claude Code CLI）：

```json
{
  "env": {
    "ANTHROPIC_BASE_URL": "https://ai-api.solaeon.com",
    "ANTHROPIC_AUTH_TOKEN": "sk-...",
    "ANTHROPIC_DEFAULT_OPUS_MODEL": "claude-opus-4-8",
    "ANTHROPIC_DEFAULT_SONNET_MODEL": "claude-sonnet-5",
    "ANTHROPIC_DEFAULT_HAIKU_MODEL": "claude-haiku-4-5",
    "API_TIMEOUT_MS": "300000",
    "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC": "1",
    "CLAUDE_CODE_ATTRIBUTION_HEADER": "0"
  },
  "model": "claude-opus-4-8",
  "availableModels": [
    "claude-sonnet-5", "claude-opus-4-8", "claude-haiku-4-5",
    "claude-sonnet-4-6", "claude-opus-4-7", "claude-opus-4-6", "claude-fable-5"
  ],
  "permissions": { "defaultMode": "acceptEdits" },
  "autoUpdaterStatus": "enabled",
  "includeCoAuthoredBy": false
}
```

同时写入 Claude Desktop 托管配置 `HKCU\Software\Policies\Claude`（`inferenceProvider=gateway` + 7 模型 `inferenceModels`），桌面版模型菜单会出全部 7 个模型，其中 Sonnet 5 / Opus 4.8 / Fable 5 额外生成 1M 变体。

> 想换模型 / 网关，直接改 `settings.json`。7 个模型：`claude-sonnet-5` · `claude-opus-4-8` · `claude-haiku-4-5` · `claude-sonnet-4-6` · `claude-opus-4-7` · `claude-opus-4-6` · `claude-fable-5`。**认证走 `ANTHROPIC_AUTH_TOKEN`（Bearer）**，这是官方 gateway 推荐的方式；base_url 必须是 HTTPS。

> **关于 `CLAUDE_CODE_ATTRIBUTION_HEADER=0`**：Claude Code 自 2.1.36 起会在每个请求的 system prompt 第一块塞一个 `x-anthropic-billing-header`，其中 `cch` 字段每次请求随机变化。Anthropic 自家服务端会剥掉它再算 prefix-cache key，但**所有第三方 Anthropic 兼容代理（LiveToken / Bedrock / vLLM 等）都不知道**，会把它当成 prompt 的一部分参与缓存哈希，导致 prefix cache 永远不命中，token 消耗暴涨、推理变慢。这个 env 把 header 关掉，缓存命中恢复正常。

---

## 常见问题

**Q：装到一半报 `spawn npm ENOENT`？**
A：极少数自定义路径安装的 Node 没被 PATH/PATHEXT 解析到。安装器已经做了三层兜底（静态路径表、cmd.exe PATH+PATHEXT、`where.exe` 反查）。如果还出，开 PowerShell 跑 `where.exe npm`，把返回路径发到 issue。

**Q：装到一半报 `C:\Program 不是命令` 或一串乱码？**
A：这是 Node 老版本 spawn 在 Windows 上的引号 bug。本工具内部已修，正常不会再出现。如果还有，提 issue。

**Q：装完跑 `claude` 提示找不到命令？**
A：必须开**新**终端窗口。环境变量更新只对新进程生效。

**Q：装完跑 `claude` 还是连 Anthropic 官方，没走 LiveToken？**
A：你之前跑过 `claude login` 走过 Anthropic OAuth，`~/.claude/.credentials.json` 里缓存了 Access Token。**实测**：
- `ANTHROPIC_BASE_URL` 永远被遵守（请求确实发到 gateway）
- 但 `Authorization: Bearer ...` 头会用**缓存的 OAuth token 而不是你的 LiveToken Key**，gateway 收到一个无效的 sk-ant-oat01-xxx，返回 401

证据：仓库里有个 [`scripts/verify-gateway.mjs`](scripts/verify-gateway.mjs)，起一个本地假 gateway 把 claude 的请求抓下来。带 credentials 时抓到的就是 `sk-ant-oat01-xxx` —— 不是我们 export 的 token。

修法：删掉 / 备份走 credentials。
- v0.1.4 起，安装器和 `install_claude.sh` 都会自动检测并把这个文件备份成 `.bak.<时间戳>` 移走。
- 如果你装的是更早的版本：手动跑一次
  ```powershell
  # Windows
  claude logout
  Remove-Item "$env:USERPROFILE\.claude\.credentials.json" -ErrorAction SilentlyContinue
  ```
  ```bash
  # macOS / Linux
  claude logout
  rm -f ~/.claude/.credentials.json
  ```
  然后关掉所有终端，重开一个再跑 `claude`。
- 要保留官方 OAuth 不动？bash 装时加 `--keep-oauth`；Electron 装时安装计划页面里手动取消"清除 Anthropic 官方 OAuth 凭据"那一步。

**Q：要换 base URL 或换模型？**
A：直接编辑 `%USERPROFILE%\.claude\settings.json`。Claude Code 启动时读这个文件。

**Q：怎么卸？**
A：
1. NSIS 版从控制面板"添加或删除程序"卸载工具本身
2. CLI 卸载：`npm uninstall -g @anthropic-ai/claude-code`
3. 清配置：删 `%USERPROFILE%\.claude\` 目录
4. 清 Key：PowerShell 跑 `[Environment]::SetEnvironmentVariable('ANTHROPIC_API_KEY', $null, 'User')`

---

## 自己 build

```bash
git clone https://github.com/OnelongX/ai-installer.git
cd ai-installer
npm install
npm test                    # 跑 74 个单测 + 组件测试
npm run build               # 输出 out/
npm run pack:win            # 出便携版 release/*.exe
npm run dist:win            # 出 NSIS 安装包
```

## 真机验证 gateway 配置是否生效

`scripts/verify-gateway.mjs` 是一个端到端的回归测试：

1. 在 `127.0.0.1:19999` 起一个假的 Anthropic Messages API（支持 streaming + `/v1/models`）
2. 用 `ANTHROPIC_BASE_URL=http://127.0.0.1:19999` + `ANTHROPIC_AUTH_TOKEN=test-xxx` 跑一次 `claude -p "say ok"`
3. 把假 gateway 收到的请求 dump 出来，对几条关键断言打勾：
   - 请求确实到了 mock，不是 api.anthropic.com
   - `Authorization: Bearer ...` 用的是**我们 set 的 token**，不是缓存的 OAuth token
   - 系统提示**第一块没有** `cch` / `x-anthropic-billing-header`（`CLAUDE_CODE_ATTRIBUTION_HEADER=0` 起作用）
   - model 字段是 claude-family
   - 没有 `tool_reference` 块（说明不需要 `ENABLE_TOOL_SEARCH=true`）

```bash
# 跑：
node scripts/verify-gateway.mjs

# 退出码 0 = 全通过；1 = 有断言失败
```

> 如果你跑过 `claude login`，**这个测试会暴露问题**：Bearer 头里是缓存的 OAuth token，而不是测试的 fake token。这就是 v0.1.4 必须先清 `.credentials.json` 的原因。我把 credentials 备份移走后再跑，就 6/6 全过了。

需要：Node ≥ 20、Windows 10/11、winget（系统自带）。

---

## 工作原理 / 修过的坑

简短说几个核心点（细节见各模块注释）：

- **exec quoting**：Windows 下 `spawn(cmd, args, {shell: true})` 不会自动给含空格的命令路径加引号，安装器用 `cmd.exe /d /s /c` + `windowsVerbatimArguments` 自己控制命令行
- **UTF-8 输出**：每条命令前置 `chcp 65001>nul &`，防止中文 Windows 上 stderr 被当 GBK 显示成乱码
- **PATH 多层兜底**：直接 spawn → cmd.exe PATH+PATHEXT → 静态路径表（Program Files / LocalAppData / AppData\npm / Volta）→ `where.exe` 运行时反查
- **PATH 刷新**：装完 Node/CLI 后用 PowerShell 读注册表 `User+Machine PATH` 写回 `process.env.PATH`，让后续步骤的命令解析能看到新装的工具
- **超时分级**：安装命令 10 分钟，验证命令 60 秒（默认 30s 对 winget 来说太短）
- **preload 契约**：preload 不再手写，直接打包 TS 编译产物；契约测试确保 `Object.keys(api) === Object.keys(ipcChannels)`，防漂移

---

## 项目结构

```
src/
├── main/                       # Electron 主进程
│   ├── installer/
│   │   ├── plan.ts             # 任务规划
│   │   ├── service.ts          # 安装编排
│   │   ├── session-controller.ts  # 持久化 + 恢复
│   │   ├── task-runner.ts      
│   │   └── tasks/
│   │       ├── detect-claude.ts
│   │       ├── detect-config.ts
│   │       ├── detect-node.ts
│   │       ├── detect-system.ts
│   │       ├── install-claude.windows.ts
│   │       ├── install-node.windows.ts
│   │       ├── persist-api-key.windows.ts
│   │       └── write-config.windows.ts
│   ├── desktop-app/windows.ts  # Claude Desktop 探测
│   └── system/
│       ├── exec.ts             # spawn + 超时 + 编码 + 引号修复
│       └── windows-command.ts  # 命令查找兜底链
├── preload/index.ts            # IPC 桥（唯一一份，打包后直接用）
├── renderer/                   # React UI
│   ├── App.tsx
│   ├── features/
│   │   ├── api-key/
│   │   ├── complete/           # 完成页 + LiveToken 介绍卡
│   │   ├── detection/
│   │   ├── execution/
│   │   ├── plan/
│   │   ├── recovery/
│   │   └── repair/
│   └── install-flow/client.ts  # 渲染端 IPC client
└── shared/                     # 两端共用的类型 / IPC 通道定义
```

---

## License

MIT
