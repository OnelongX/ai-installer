# Codex Installer Design

**Date:** 2026-04-23

**Status:** Approved

**Goal**

Build a cross-platform desktop installer center for Codex. The app must provide a GUI, execute installation and repair flows through system shell commands, always require the user to enter or confirm an API key before installation, and support automatic installation with manual fallback guidance.

## Product Summary

The product is a desktop application that helps users install and configure Codex with guided workflows instead of manual command execution. It targets Windows, macOS, and Linux from the start, but the first implementation prioritizes a complete Windows path while keeping the architecture platform-extensible.

The installer is not a thin script wrapper. It is an installation center with:

- environment detection
- dependency installation
- Codex CLI installation
- API key capture and configuration
- config file generation
- live logs
- structured repair suggestions
- retry and resume support
- diagnostic export

## Recommended Technical Approach

### Option A: Electron + React + TypeScript + Node child processes

Pros:

- mature cross-platform desktop stack
- straightforward process execution and shell integration
- strong support for task orchestration and streaming logs
- practical packaging story for installer-like software

Cons:

- larger app bundle
- main/renderer security boundaries must be explicit

### Option B: Tauri + frontend + Rust command bridge

Pros:

- smaller footprint
- strong runtime characteristics

Cons:

- higher complexity for shell execution, privilege handling, and platform-specific installation behavior
- slower delivery for an installation-heavy product

### Option C: GUI wrapper over external scripts

Pros:

- fastest initial build

Cons:

- poor maintainability
- weak state management and recovery behavior
- hard to keep cross-platform behavior consistent

### Recommendation

Use Electron with React and TypeScript. This product's complexity is in orchestration, system integration, privilege handling, and recovery flows. Electron is the most pragmatic choice for the first deliverable.

## Architecture

The application is split into four layers.

### 1. Renderer

The React renderer owns presentation and user input only. It shows environment status, API key entry, installation plans, live logs, repair guidance, and final results.

It must not execute shell commands directly.

### 2. Electron Main Process

The main process owns:

- IPC boundary
- task scheduling
- platform detection
- secure key handling
- log aggregation
- file system operations
- process spawning

The main process converts user actions into controlled installer tasks.

### 3. Installer Engine

The installer engine executes workflows through a standard task model. Each task supports:

- precheck
- execution
- verification
- repair suggestion generation
- retry policy
- resume support

This engine allows future flows such as upgrade, repair, reinstall, and uninstall to reuse the same primitives.

### 4. Platform Adapters

Platform-specific behavior is isolated behind adapters:

- Windows: PowerShell, winget, environment variables, optional WSL2 guidance
- macOS: shell scripts, Homebrew, shell profile updates
- Linux: distribution detection, package manager selection, shell profile updates

The platform adapter layer hides command differences from the installer engine and UI.

## User Flow

The approved primary flow is:

`Welcome -> API Key -> Environment Detection -> Install Plan -> Execute -> Repair if Needed -> Complete`

The installer must always stop on the API key step first. Installation cannot continue until the user either enters a new key or confirms use of an existing key.

## Screen Design

### Welcome

Explains what the application does and provides:

- Quick Install
- Custom Install

### API Key

Required before installation begins.

Capabilities:

- enter a new key
- detect an existing `OPENAI_API_KEY`
- let the user confirm reuse of the existing key
- let the user replace it with a new key
- validate format and connectivity before planning installation

Security requirements:

- hidden input by default
- show/hide toggle
- never print full key in logs

### Environment Detection

Shows readiness and repairability for:

- OS and version
- shell
- Node.js and npm
- package manager
- Git
- network access
- optional WSL2 on Windows
- current Codex installation state
- existing config file state

Each item displays a machine-readable status:

- satisfied
- auto-fixable
- manual action required
- skipped

### Install Plan

Shows exactly which steps will run, such as:

- install Node.js
- install Codex CLI
- write `OPENAI_API_KEY`
- create or update `config.toml`
- verify `codex --version`
- verify final runtime access

Advanced options:

- official endpoint or custom base URL
- write key to user environment variables
- use session-only key for current run
- enable verbose diagnostics

### Execution

The core operations view. It must show:

- current task
- task progress
- live logs
- task result states
- retry current step
- resume from failure
- export diagnostics

### Repair

Shown when execution fails. The view maps failures into guided actions instead of raw stderr.

Expected categories:

- missing privilege
- network failure
- package manager failure
- PATH refresh issue
- shell policy restriction
- invalid endpoint or proxy
- invalid API key
- config parsing problem

Each category should expose one or more actions:

- automatic retry
- automatic fix
- copy manual command
- open help text
- skip non-critical step

### Complete

Summarizes:

- Codex installed or not
- Codex version
- config file path
- masked API key status
- next commands
- access to logs and diagnostics

## Installer Engine Design

Each workflow consists of standard tasks with this model:

- `id`
- `title`
- `platforms`
- `dependencies`
- `check()`
- `run()`
- `verify()`
- `repairSuggestions()`
- `retryPolicy`
- `rollbackNote`

Initial core tasks:

- `detect-system`
- `detect-node`
- `install-node`
- `detect-codex`
- `install-codex`
- `capture-api-key`
- `validate-api-key`
- `persist-openai-api-key`
- `write-config`
- `verify-codex-runtime`
- `export-diagnostics`

## Failure Handling

The approved strategy is recoverable installation, not aggressive rollback.

Supported recovery behaviors:

- retry transient failures
- continue from failed step after repair
- skip non-critical steps with warning
- re-enter invalid user configuration

Every failure becomes a structured error object with:

- `category`
- `message`
- `rawOutput`
- `likelyCause`
- `userAction`
- `canRetry`
- `canResume`
- `requiresPrivilege`
- `docsLink`

## API Key Requirements

The user clarified a hard requirement: installation must always prompt for key input or explicit key confirmation.

Approved behavior:

- the API key step is mandatory
- if an existing `OPENAI_API_KEY` is detected, the user must still choose whether to reuse or replace it
- installation cannot proceed without user confirmation
- the full key is never shown on completion pages, logs, or diagnostic exports

The key must not be written into `config.toml`. The generated config references `env_key = "OPENAI_API_KEY"` instead.

## Configuration Strategy

The installer should generate or update `~/.codex/config.toml` using one of two modes:

- official OpenAI endpoint
- custom endpoint and provider settings

The installer can optionally write the API key to a user-level environment variable after the user explicitly approves persistence.

## Logging and Diagnostics

Three log layers are required:

- user-readable progress logs
- technical execution logs
- structured diagnostic summary

Diagnostic export must mask secrets and include:

- platform information
- installation plan
- step execution results
- sanitized stdout and stderr
- configuration detection results
- validation results
- repair suggestions

## MVP Scope

The first version should include:

- Electron shell
- React renderer
- TypeScript codebase
- installer engine abstraction
- Windows full-path implementation
- macOS and Linux adapter scaffolding
- mandatory API key confirmation step
- Node detection and installation
- Codex CLI detection and installation
- `OPENAI_API_KEY` persistence option
- `config.toml` generation or update
- verification flow
- retry and resume behavior
- diagnostic export

Out of scope for v1:

- full automated WSL2 installation
- advanced enterprise policy management
- multi-profile account switching
- fully automated uninstall cleanup
- deep proxy management UX beyond essential endpoint configuration

## Open Risks

- installer behavior differs significantly across package managers and operating systems
- privilege elevation UX varies by platform
- network and endpoint validation must be robust but not block legitimate custom setups
- environment variable propagation behaves differently across shells and sessions

## Next Step

Write a concrete implementation plan for an Electron-based codebase that starts with a complete Windows path and leaves clear extension points for macOS and Linux.
