function quotePowerShellSingle(value: string) {
  return `'${value.replace(/'/g, "''")}'`
}

export function buildPersistApiKeyCommand(apiKey: string) {
  const quoted = quotePowerShellSingle(apiKey)
  return `[Environment]::SetEnvironmentVariable('ANTHROPIC_API_KEY', ${quoted}, 'User')`
}

export function getPersistApiKeyWindowsCommand(apiKey: string) {
  return {
    args: ['-NoProfile', '-Command', buildPersistApiKeyCommand(apiKey)],
    command: 'powershell'
  }
}
