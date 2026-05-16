# Codex 安装器

Codex 安装器是一个用于安装、恢复和验证 Codex 的桌面安装中心。它会引导用户完成 API Key 确认、环境检测、安装计划确认、修复建议和诊断导出，而不是让用户自己手动执行一串命令。

## 技术栈

- Electron
- React
- TypeScript
- Vite
- Vitest
- Playwright

## 开发

安装依赖：

```powershell
npm install
```

运行测试：

```powershell
npm test
```

运行端到端流程：

```powershell
npm run test:e2e -- tests/e2e/install-flow.spec.ts
```

构建应用：

```powershell
npm run build
```

生成 Windows 安装包：

```powershell
npm run dist:win
```

生成 Windows 便携版：

```powershell
npm run pack:win
```

对打包后的便携版执行启动自检：

```powershell
npm run smoke:packaged
```

## macOS Python 安装脚本

仓库根目录新增了单文件脚本 [install_codex_macos.py](C:\Users\Administrator\Desktop\codex\install_codex_macos.py)，用于在 macOS 上通过命令行安装 Codex。

交互式运行：

```bash
python3 install_codex_macos.py
```

非交互运行：

```bash
python3 install_codex_macos.py --non-interactive --api-key "sk-xxx" --write-shell-profile
```

脚本行为：

- 仅支持 macOS
- 缺少 `node` / `npm` 时自动下载并安装官方 Node.js `pkg`
- 强制要求提供 `OPENAI_API_KEY`
- 安装 `@openai/codex`
- 写入 `~/.codex/config.toml`
- 可选写入 `~/.zshrc` 或 `~/.bash_profile`
- 最后验证 `codex --version`

Python 单测：

```powershell
python -m unittest discover -s tests_python -p "test_*.py"
```

## 当前流程覆盖

当前界面已经覆盖这条分阶段流程：

1. API Key 确认
2. 环境检测
3. 安装计划确认
4. 执行进度
5. 完成摘要

仓库中还包含修复页、完成页、诊断导出逻辑，以及 Windows 安装任务骨架。

## 目录说明

- `src/renderer/App.tsx`：顶层界面流程
- `src/renderer/features/*`：UI 步骤页和恢复页面
- `src/main/installer/*`：安装计划、任务执行和安装任务骨架
- `src/main/system/*`：命令执行与敏感信息脱敏
- `src/main/diagnostics/export.ts`：诊断报告渲染

## 当前状态

Windows 是当前第一个完整落地的平台。macOS 和 Linux 适配器已经有骨架，但真实安装流程还没有接完。

## 打包产物

Windows 打包使用 `electron-builder`，产物会输出到 `release` 目录，未打包的 Electron 构建产物仍然输出到 `out`。

当前中文产物名如下：

- 安装包：`release/Codex 安装器 安装包 0.1.0.exe`
- 便携版：`release/Codex 安装器 便携版 0.1.0.exe`
- 自检报告：`release/smoke-test/packaged-startup-report.json`

打包版启动自检会以隐藏参数 `--smoke-test-output=...` 启动便携版，等待应用完成加载，并确认 `release/smoke-test` 下写出了 JSON 报告。
