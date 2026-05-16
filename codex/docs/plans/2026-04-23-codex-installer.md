# Codex Installer Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a cross-platform desktop installer center for Codex that uses a GUI to guide environment checks, API key confirmation, installation, repair, and diagnostics.

**Architecture:** Start from a new Electron + React + TypeScript application. Keep UI, IPC, installer engine, and platform adapters separated so Windows can be implemented first without blocking later macOS and Linux support.

**Tech Stack:** Electron, React, TypeScript, Vite, Vitest, Playwright, Node child processes, PowerShell, npm

---

### Task 1: Scaffold the desktop app

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`
- Create: `vite.config.ts`
- Create: `electron.vite.config.ts`
- Create: `src/main/index.ts`
- Create: `src/preload/index.ts`
- Create: `src/renderer/index.html`
- Create: `src/renderer/main.tsx`
- Create: `src/renderer/App.tsx`
- Create: `src/shared/types.ts`
- Create: `tests/smoke/app-shell.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import { appShellTitle } from '../../src/shared/types'

describe('app shell constants', () => {
  it('defines the installer window title', () => {
    expect(appShellTitle).toBe('Codex Installer')
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npm test -- --run tests/smoke/app-shell.test.ts`
Expected: FAIL because the project files do not exist yet.

**Step 3: Write minimal implementation**

Create the Electron/Vite project files and export:

```ts
export const appShellTitle = 'Codex Installer'
```

Render a minimal React shell that shows the title in the main window.

**Step 4: Run test to verify it passes**

Run: `npm test -- --run tests/smoke/app-shell.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add package.json tsconfig.json tsconfig.node.json vite.config.ts electron.vite.config.ts src tests
git commit -m "feat: scaffold codex installer app"
```

### Task 2: Define installer domain models

**Files:**
- Create: `src/shared/installer.ts`
- Create: `src/shared/errors.ts`
- Create: `tests/unit/installer-models.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import { taskStatusValues, errorCategories } from '../../src/shared/installer'

describe('installer domain models', () => {
  it('defines supported task statuses', () => {
    expect(taskStatusValues).toContain('failed')
  })

  it('defines structured error categories', () => {
    expect(errorCategories).toContain('network')
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npm test -- --run tests/unit/installer-models.test.ts`
Expected: FAIL because the installer model files do not exist yet.

**Step 3: Write minimal implementation**

Add shared types for:

- task definitions
- execution state
- diagnostic event payloads
- structured error objects
- API key mode selection

**Step 4: Run test to verify it passes**

Run: `npm test -- --run tests/unit/installer-models.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/shared tests/unit
git commit -m "feat: add installer domain models"
```

### Task 3: Build the IPC contract

**Files:**
- Create: `src/shared/ipc.ts`
- Modify: `src/main/index.ts`
- Modify: `src/preload/index.ts`
- Create: `tests/unit/ipc-contract.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import { ipcChannels } from '../../src/shared/ipc'

describe('ipc contract', () => {
  it('exposes install workflow channels', () => {
    expect(ipcChannels.startInstall).toBe('installer:start')
    expect(ipcChannels.subscribeLogs).toBe('installer:subscribe-logs')
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npm test -- --run tests/unit/ipc-contract.test.ts`
Expected: FAIL because the IPC contract has not been defined.

**Step 3: Write minimal implementation**

Define a typed IPC contract for:

- loading environment state
- validating API key
- generating install plans
- starting execution
- subscribing to progress and logs
- retrying a failed task
- resuming a workflow
- exporting diagnostics

Expose only these APIs through the preload bridge.

**Step 4: Run test to verify it passes**

Run: `npm test -- --run tests/unit/ipc-contract.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/shared/ipc.ts src/main/index.ts src/preload/index.ts tests/unit/ipc-contract.test.ts
git commit -m "feat: add installer ipc contract"
```

### Task 4: Implement the task runner core

**Files:**
- Create: `src/main/installer/task-runner.ts`
- Create: `src/main/installer/task-registry.ts`
- Create: `src/main/installer/context.ts`
- Create: `tests/unit/task-runner.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import { runTasks } from '../../src/main/installer/task-runner'

describe('task runner', () => {
  it('runs tasks in dependency order', async () => {
    const events = await runTasks([
      { id: 'a', dependencies: [], check: async () => false, run: async () => {}, verify: async () => true },
      { id: 'b', dependencies: ['a'], check: async () => false, run: async () => {}, verify: async () => true },
    ])

    expect(events.map((event) => event.taskId)).toEqual(['a', 'b'])
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npm test -- --run tests/unit/task-runner.test.ts`
Expected: FAIL because the task runner does not exist.

**Step 3: Write minimal implementation**

Implement a runner that:

- resolves dependencies
- runs `check`, `run`, and `verify`
- emits task state events
- stores step results for resume
- stops on failure and returns structured failure data

**Step 4: Run test to verify it passes**

Run: `npm test -- --run tests/unit/task-runner.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/main/installer tests/unit/task-runner.test.ts
git commit -m "feat: add installer task runner"
```

### Task 5: Add process execution and log sanitization

**Files:**
- Create: `src/main/system/exec.ts`
- Create: `src/main/system/sanitize.ts`
- Create: `tests/unit/sanitize.test.ts`
- Create: `tests/unit/exec.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import { maskSecrets } from '../../src/main/system/sanitize'

describe('secret masking', () => {
  it('masks API keys in log text', () => {
    expect(maskSecrets('OPENAI_API_KEY=sk-test-secret')).not.toContain('sk-test-secret')
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npm test -- --run tests/unit/sanitize.test.ts`
Expected: FAIL because the sanitizer does not exist.

**Step 3: Write minimal implementation**

Implement:

- child-process execution with stdout and stderr streaming
- timeout support
- exit code capture
- secret masking for logs and diagnostic output

**Step 4: Run test to verify it passes**

Run: `npm test -- --run tests/unit/sanitize.test.ts tests/unit/exec.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/main/system tests/unit/sanitize.test.ts tests/unit/exec.test.ts
git commit -m "feat: add process execution and log masking"
```

### Task 6: Implement platform detection and adapter selection

**Files:**
- Create: `src/main/platform/detect.ts`
- Create: `src/main/platform/types.ts`
- Create: `src/main/platform/index.ts`
- Create: `src/main/platform/windows.ts`
- Create: `src/main/platform/macos.ts`
- Create: `src/main/platform/linux.ts`
- Create: `tests/unit/platform-detect.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import { normalizePlatform } from '../../src/main/platform/detect'

describe('platform detection', () => {
  it('maps win32 to windows', () => {
    expect(normalizePlatform('win32')).toBe('windows')
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npm test -- --run tests/unit/platform-detect.test.ts`
Expected: FAIL because platform detection is missing.

**Step 3: Write minimal implementation**

Create platform adapter interfaces and return:

- a Windows adapter with real commands
- macOS and Linux placeholder adapters that expose capability gaps without crashing

**Step 4: Run test to verify it passes**

Run: `npm test -- --run tests/unit/platform-detect.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/main/platform tests/unit/platform-detect.test.ts
git commit -m "feat: add platform adapter selection"
```

### Task 7: Add the API key entry and confirmation flow

**Files:**
- Create: `src/renderer/features/api-key/ApiKeyStep.tsx`
- Create: `src/renderer/features/api-key/api-key-state.ts`
- Modify: `src/renderer/App.tsx`
- Create: `tests/unit/api-key-state.test.ts`
- Create: `tests/component/api-key-step.test.tsx`

**Step 1: Write the failing test**

```tsx
import { render, screen } from '@testing-library/react'
import { ApiKeyStep } from '../../src/renderer/features/api-key/ApiKeyStep'

it('requires the user to confirm or enter a key before continuing', () => {
  render(<ApiKeyStep existingKeyMask="sk-***1234" canReuseExistingKey />)
  expect(screen.getByText('Continue')).toBeDisabled()
})
```

**Step 2: Run test to verify it fails**

Run: `npm test -- --run tests/component/api-key-step.test.tsx`
Expected: FAIL because the UI and state do not exist.

**Step 3: Write minimal implementation**

Build the API key step with:

- hidden input
- show or hide toggle
- reuse existing key option
- replace existing key option
- disabled continue button until a valid choice is made

**Step 4: Run test to verify it passes**

Run: `npm test -- --run tests/unit/api-key-state.test.ts tests/component/api-key-step.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/renderer/features/api-key src/renderer/App.tsx tests/unit/api-key-state.test.ts tests/component/api-key-step.test.tsx
git commit -m "feat: add mandatory api key flow"
```

### Task 8: Build the environment detection workflow

**Files:**
- Create: `src/main/installer/tasks/detect-system.ts`
- Create: `src/main/installer/tasks/detect-node.ts`
- Create: `src/main/installer/tasks/detect-codex.ts`
- Create: `src/renderer/features/detection/DetectionView.tsx`
- Create: `tests/unit/detect-node.test.ts`
- Create: `tests/component/detection-view.test.tsx`

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import { classifyNodeState } from '../../src/main/installer/tasks/detect-node'

describe('node detection', () => {
  it('marks a missing installation as auto-fixable', () => {
    expect(classifyNodeState(null)).toBe('auto-fixable')
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npm test -- --run tests/unit/detect-node.test.ts`
Expected: FAIL because the detection task does not exist.

**Step 3: Write minimal implementation**

Implement detection tasks and a renderer view that shows:

- status badge
- details
- auto-fix or manual action state

**Step 4: Run test to verify it passes**

Run: `npm test -- --run tests/unit/detect-node.test.ts tests/component/detection-view.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/main/installer/tasks src/renderer/features/detection tests/unit/detect-node.test.ts tests/component/detection-view.test.tsx
git commit -m "feat: add environment detection flow"
```

### Task 9: Implement install planning

**Files:**
- Create: `src/main/installer/plan.ts`
- Create: `src/renderer/features/plan/PlanView.tsx`
- Create: `tests/unit/plan.test.ts`
- Create: `tests/component/plan-view.test.tsx`

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import { buildInstallPlan } from '../../src/main/installer/plan'

describe('install planning', () => {
  it('includes codex installation when codex is missing', () => {
    const plan = buildInstallPlan({ codexInstalled: false, nodeInstalled: true })
    expect(plan.tasks).toContain('install-codex')
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npm test -- --run tests/unit/plan.test.ts`
Expected: FAIL because plan generation has not been implemented.

**Step 3: Write minimal implementation**

Generate plans from environment state and API key choices. Render them in a review screen before execution starts.

**Step 4: Run test to verify it passes**

Run: `npm test -- --run tests/unit/plan.test.ts tests/component/plan-view.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/main/installer/plan.ts src/renderer/features/plan tests/unit/plan.test.ts tests/component/plan-view.test.tsx
git commit -m "feat: add install planning"
```

### Task 10: Implement the Windows install tasks

**Files:**
- Create: `src/main/installer/tasks/install-node.windows.ts`
- Create: `src/main/installer/tasks/install-codex.windows.ts`
- Create: `src/main/installer/tasks/persist-api-key.windows.ts`
- Create: `src/main/installer/tasks/write-config.windows.ts`
- Create: `tests/unit/write-config.windows.test.ts`
- Create: `tests/unit/persist-api-key.windows.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import { buildConfigToml } from '../../src/main/installer/tasks/write-config.windows'

describe('windows config generation', () => {
  it('references OPENAI_API_KEY instead of embedding the secret', () => {
    expect(buildConfigToml({ mode: 'official' })).toContain('env_key = "OPENAI_API_KEY"')
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npm test -- --run tests/unit/write-config.windows.test.ts`
Expected: FAIL because the Windows task implementations do not exist.

**Step 3: Write minimal implementation**

Implement Windows-specific tasks for:

- installing Node.js
- installing `@openai/codex`
- persisting `OPENAI_API_KEY`
- writing `config.toml`
- verifying `codex --version`

**Step 4: Run test to verify it passes**

Run: `npm test -- --run tests/unit/write-config.windows.test.ts tests/unit/persist-api-key.windows.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/main/installer/tasks tests/unit/write-config.windows.test.ts tests/unit/persist-api-key.windows.test.ts
git commit -m "feat: add windows install tasks"
```

### Task 11: Build the execution, repair, and completion views

**Files:**
- Create: `src/renderer/features/execution/ExecutionView.tsx`
- Create: `src/renderer/features/repair/RepairView.tsx`
- Create: `src/renderer/features/complete/CompleteView.tsx`
- Create: `tests/component/execution-view.test.tsx`
- Create: `tests/component/repair-view.test.tsx`
- Create: `tests/component/complete-view.test.tsx`

**Step 1: Write the failing test**

```tsx
import { render, screen } from '@testing-library/react'
import { ExecutionView } from '../../src/renderer/features/execution/ExecutionView'

it('shows retry and resume controls after a failed task', () => {
  render(<ExecutionView state={{ currentTask: 'install-codex', failedTask: 'install-codex' }} />)
  expect(screen.getByText('Retry Current Step')).toBeInTheDocument()
  expect(screen.getByText('Resume')).toBeInTheDocument()
})
```

**Step 2: Run test to verify it fails**

Run: `npm test -- --run tests/component/execution-view.test.tsx`
Expected: FAIL because the execution UI does not exist.

**Step 3: Write minimal implementation**

Create views for:

- live execution state
- repair actions from structured errors
- final completion summary with masked key information

**Step 4: Run test to verify it passes**

Run: `npm test -- --run tests/component/execution-view.test.tsx tests/component/repair-view.test.tsx tests/component/complete-view.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/renderer/features/execution src/renderer/features/repair src/renderer/features/complete tests/component
git commit -m "feat: add execution and recovery views"
```

### Task 12: Add diagnostic export

**Files:**
- Create: `src/main/diagnostics/export.ts`
- Create: `tests/unit/diagnostic-export.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import { renderDiagnosticReport } from '../../src/main/diagnostics/export'

describe('diagnostic export', () => {
  it('masks secrets in exported reports', () => {
    const report = renderDiagnosticReport({ logs: ['OPENAI_API_KEY=sk-secret'] })
    expect(report).not.toContain('sk-secret')
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npm test -- --run tests/unit/diagnostic-export.test.ts`
Expected: FAIL because diagnostic export is not implemented.

**Step 3: Write minimal implementation**

Implement a diagnostic exporter that writes a masked text or JSON report with:

- platform details
- task results
- logs
- final state
- repair guidance

**Step 4: Run test to verify it passes**

Run: `npm test -- --run tests/unit/diagnostic-export.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/main/diagnostics/export.ts tests/unit/diagnostic-export.test.ts
git commit -m "feat: add diagnostic export"
```

### Task 13: Add end-to-end happy-path verification

**Files:**
- Create: `playwright.config.ts`
- Create: `tests/e2e/install-flow.spec.ts`
- Modify: `package.json`

**Step 1: Write the failing test**

```ts
import { test, expect } from '@playwright/test'

test('user can move from api key step to install plan', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('API Key').fill('sk-test-key')
  await page.getByRole('button', { name: 'Continue' }).click()
  await expect(page.getByText('Install Plan')).toBeVisible()
})
```

**Step 2: Run test to verify it fails**

Run: `npm run test:e2e -- tests/e2e/install-flow.spec.ts`
Expected: FAIL because the e2e harness does not exist yet.

**Step 3: Write minimal implementation**

Add Playwright wiring and enough application state flow to cover:

- API key page
- detection page
- plan page

**Step 4: Run test to verify it passes**

Run: `npm run test:e2e -- tests/e2e/install-flow.spec.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add playwright.config.ts tests/e2e/install-flow.spec.ts package.json
git commit -m "test: add e2e install flow"
```

### Task 14: Write setup and usage documentation

**Files:**
- Modify: `CODEX_SETUP.md`
- Create: `README.md`

**Step 1: Write the failing test**

This task is documentation-only. No automated failing test is required.

**Step 2: Verify documentation gaps**

Review current docs and confirm they do not describe the desktop installer flow.

**Step 3: Write minimal implementation**

Document:

- local development setup
- how to run the installer app
- supported platforms
- current Windows-first implementation status
- test commands

**Step 4: Verify the docs**

Run: `Get-Content README.md`
Expected: documents local setup and usage of the installer.

**Step 5: Commit**

```bash
git add CODEX_SETUP.md README.md
git commit -m "docs: add installer development guide"
```
