# Codex macOS Python Installer Design

## Goal

Provide a single-file Python command-line installer for macOS that can:

- verify the host is macOS
- detect `node`, `npm`, and `codex`
- automatically install Node.js from the official package when missing
- require the user to provide an `OPENAI_API_KEY`
- install `@openai/codex`
- write `~/.codex/config.toml`
- optionally persist `OPENAI_API_KEY` into the user's shell profile
- verify the final Codex installation

## Scope

This first version targets only macOS and focuses on the primary install path.

Included:

- interactive CLI flow in Chinese
- non-interactive mode with required flags
- official Node.js package download and installation
- Codex CLI installation through `npm`
- `config.toml` generation that references `OPENAI_API_KEY`
- optional shell profile persistence
- structured Chinese logging and exit codes

Excluded:

- GUI
- proxy wizard
- uninstall or update flows
- code signing or notarization
- automatic package checksum verification against a remote manifest

## File Shape

Implementation is a single file named `install_codex_macos.py`.

The file remains physically single-file but is logically split into:

- argument parsing
- environment detection
- Node.js package resolution and download
- process execution helpers
- API key prompting and validation
- config generation
- shell profile persistence
- final verification

## Runtime Behavior

Default mode is interactive.

Flow:

1. Confirm the host is macOS.
2. Detect current shell, profile path, and install state.
3. If `node` or `npm` is missing:
   - resolve the official Node.js macOS package URL
   - download the package into a temporary directory
   - install it with `sudo installer -pkg ... -target /`
4. Prompt for `OPENAI_API_KEY` unless supplied by `--api-key`.
5. Run `npm i -g @openai/codex`.
6. Write `~/.codex/config.toml`.
7. Optionally write `OPENAI_API_KEY` to the user's shell profile.
8. Run `codex --version`.
9. Print a Chinese success summary.

## CLI Interface

Supported flags:

- `--api-key`
- `--base-url`
- `--write-shell-profile`
- `--skip-node-install`
- `--non-interactive`

Rules:

- interactive mode may prompt for missing inputs
- non-interactive mode must fail fast when required inputs are missing
- `config.toml` must not store the API key in plaintext

## Error Model

Primary error classes:

- environment errors
- download errors
- permission errors
- install command errors
- configuration errors

Each fatal error should print:

- what failed
- likely cause
- suggested next action

Tracebacks should be suppressed by default for user-facing runs.

## Permissions

Only the Node.js package install step should require elevated privileges.

User-owned files must remain user-scoped:

- `~/.codex/config.toml`
- `~/.zshrc`
- `~/.bash_profile`

## Testing Strategy

Python-side tests should cover:

- shell profile path selection
- config output generation
- API key validation
- Node.js package URL generation
- append-or-replace shell export logic

Process and network behavior should be mocked in tests rather than performing real installs.
