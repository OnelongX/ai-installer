function quotePowerShellSingle(value: string) {
  return `'${value.replace(/'/g, "''")}'`
}

export function buildPersistApiKeyCommand(apiKey: string) {
  const quoted = quotePowerShellSingle(apiKey)
  // Persist as ANTHROPIC_AUTH_TOKEN (Bearer) — the gateway-recommended auth.
  // settings.json also carries it, but a user-level env var lets a raw
  // `claude` in a fresh terminal work even outside a configured project.
  return `[Environment]::SetEnvironmentVariable('ANTHROPIC_AUTH_TOKEN', ${quoted}, 'User')`
}

export function getPersistApiKeyWindowsCommand(apiKey: string) {
  return {
    args: ['-NoProfile', '-Command', buildPersistApiKeyCommand(apiKey)],
    command: 'powershell'
  }
}
