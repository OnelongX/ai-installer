export function getInstallClaudeWindowsCommand() {
  return {
    args: ['i', '-g', '@anthropic-ai/claude-code'],
    command: 'npm'
  }
}
