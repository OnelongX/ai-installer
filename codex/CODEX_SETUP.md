# Codex 安装器开发说明

这个仓库是一个用 Electron、React 和 TypeScript 构建的 Codex 桌面安装中心。

## 前置条件

- Node.js 24 or newer
- npm 11 or newer
- 当前以 Windows 为主要实现目标

检查本地工具链：

```powershell
node -v
npm -v
```

## 安装依赖

```powershell
npm install
```

## 运行测试

单元、组件和流程测试：

```powershell
npm test
```

Playwright 端到端测试：

```powershell
npm run test:e2e -- tests/e2e/install-flow.spec.ts
```

如果还没有安装 Playwright 浏览器：

```powershell
npx playwright install chromium
```

## 构建桌面应用

```powershell
npm run build
```

## 运行 macOS Python 安装脚本

单文件脚本路径：

- [install_codex_macos.py](C:\Users\Administrator\Desktop\codex\install_codex_macos.py)

交互式：

```bash
python3 install_codex_macos.py
```

非交互式：

```bash
python3 install_codex_macos.py --non-interactive --api-key "sk-xxx" --write-shell-profile
```

Python 测试：

```powershell
python -m unittest discover -s tests_python -p "test_*.py"
```

## 当前产品范围

当前实现已经包含：

- 安装前的 API Key 确认
- 环境检测页面
- 安装计划生成
- 渲染层中的执行与完成流程
- Windows 下 Node、Codex、API Key 写入和配置文件写入命令生成
- 执行页、修复页和完成页
- 带敏感信息脱敏的诊断报告渲染
- macOS 单文件 Python 命令行安装脚本

## 当前缺口

当前仓库还没有包含：

- 从 UI 端到端真正执行 Windows 安装命令的完整安装引擎
- 卸载或更新工作流
- 超出适配器骨架之外的 macOS / Linux 安装实现

## Windows 安装说明

Windows 侧的安装流程底层仍然围绕这些命令展开：

安装 Codex CLI：

```powershell
npm i -g @openai/codex
```

为当前用户写入 API Key：

```powershell
[Environment]::SetEnvironmentVariable("OPENAI_API_KEY", "<YOUR_OPENAI_API_KEY>", "User")
```

验证 Codex 是否可用：

```powershell
codex --version
```
