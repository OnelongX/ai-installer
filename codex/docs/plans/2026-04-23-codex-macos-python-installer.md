# Codex macOS Python Installer Plan

## Task 1: Add Python unit tests

Create a Python test module that verifies:

- API key validation rejects invalid values
- config generation uses `env_key = "OPENAI_API_KEY"`
- shell profile export insertion is idempotent
- shell profile resolution prefers `zsh` and falls back to `bash`
- Node.js package URL selection returns a macOS package URL

Verification:

- `python -m unittest discover -s tests_python -p "test_*.py"`

## Task 2: Implement single-file installer

Create `install_codex_macos.py` with:

- argument parsing
- user-facing Chinese logging
- macOS detection
- command execution helper
- Node.js detection and install path
- API key prompting
- Codex install
- config write
- optional shell profile persistence
- final verification

Verification:

- targeted Python unit tests pass

## Task 3: Add usage documentation

Document:

- interactive usage
- non-interactive usage
- shell profile behavior
- expected `sudo` prompt during Node.js installation

Verification:

- docs reference the actual script path and flags

## Task 4: Final verification

Run:

- `python -m unittest discover -s tests_python -p "test_*.py"`
- `npm test`

Optional if unchanged but still useful:

- `npm run build`
