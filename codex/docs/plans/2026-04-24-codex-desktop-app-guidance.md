# Codex Desktop App Guidance Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在安装完成页检测 Codex 桌面版是否已安装，并提供打开应用或前往安装的引导入口。

**Architecture:** 新增一个主进程桌面版状态服务，负责 Windows 常见安装路径探测、打开本地桌面版、打开安装引导链接。通过 IPC 暴露给渲染层，完成页基于状态切换按钮和文案，不改动主安装计划。

**Tech Stack:** Electron main/preload IPC, React, Vitest

---

### Task 1: 定义桌面版状态契约

**Files:**
- Modify: `src/shared/ipc.ts`

**Step 1: 写失败测试**
- 在完成页组件测试中断言桌面版状态决定按钮文案。

**Step 2: 最小实现**
- 新增桌面版状态类型与 IPC 通道。

### Task 2: 实现 Windows 检测与打开逻辑

**Files:**
- Create: `src/main/desktop-app/windows.ts`
- Modify: `src/main/index.ts`
- Modify: `src/preload/index.ts`

**Step 1: 写失败测试**
- 桌面版检测服务测试：已安装返回 launchPath，未安装返回 downloadUrl。

**Step 2: 最小实现**
- 检查常见 Windows 路径。
- 通过 Electron shell 打开本地 exe 或外部下载地址。

### Task 3: 接入完成页

**Files:**
- Modify: `src/renderer/App.tsx`
- Modify: `src/renderer/features/complete/CompleteView.tsx`
- Test: `tests/component/complete-view.test.tsx`

**Step 1: 写失败测试**
- 已安装态显示“打开 Codex 桌面版”。
- 未安装态显示“前往安装 Codex 桌面版”。

**Step 2: 最小实现**
- 完成页加载桌面版状态。
- 绑定打开/安装按钮行为。

### Task 4: 验证

**Run:**
- `npm test`
- `npm run build`
