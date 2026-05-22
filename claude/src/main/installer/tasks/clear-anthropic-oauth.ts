import path from 'node:path'

// Claude Code stores its OAuth token (after `claude login`) at
// %USERPROFILE%\.claude\.credentials.json on Windows and ~/.claude/.credentials.json
// on Unix. While that file exists, Claude Code uses the cached OAuth flow and
// silently ignores ANTHROPIC_API_KEY + ANTHROPIC_BASE_URL — meaning the
// LiveToken gateway override never takes effect. The installer detects and
// (with the user's plan approval) removes that file so the new env-based
// config can win.

export function getOAuthCredentialsPath(userProfile: string) {
  return path.join(userProfile, '.claude', '.credentials.json')
}

interface OAuthDeps {
  fileExists(path: string): Promise<boolean>
}

export async function detectOAuthCredentials(deps: OAuthDeps, userProfile: string) {
  const credPath = getOAuthCredentialsPath(userProfile)
  return {
    exists: await deps.fileExists(credPath),
    path: credPath
  }
}

interface ClearDeps {
  fileExists(path: string): Promise<boolean>
  rename(from: string, to: string): Promise<void>
}

export async function clearOAuthCredentials(deps: ClearDeps, userProfile: string) {
  const credPath = getOAuthCredentialsPath(userProfile)

  if (!(await deps.fileExists(credPath))) {
    return { cleared: false, backupPath: null as string | null }
  }

  // Keep a timestamped backup rather than hard-deleting — restores trivial.
  const stamp = new Date()
    .toISOString()
    .replace(/[-:]/g, '')
    .replace('T', '-')
    .slice(0, 15)
  const backupPath = `${credPath}.bak.${stamp}`

  await deps.rename(credPath, backupPath)

  return { cleared: true, backupPath }
}
