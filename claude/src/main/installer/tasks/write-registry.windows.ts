import { claudeModels, type ResolvedProvider } from '../../../shared/provider-config'

// Claude Desktop reads managed gateway config from HKCU\Software\Policies\Claude.
// Writing these REG_SZ values makes the Desktop app's model picker list our
// 7 base models (plus the three 1M variants, generated from supports1m) and
// route inference through the chosen gateway instead of api.anthropic.com.
//
// This complements settings.json: settings.json configures the Claude Code CLI,
// the registry configures the Claude Desktop application.

export const CLAUDE_POLICY_KEY = 'HKCU\\Software\\Policies\\Claude'

interface RegistryValue {
  name: string
  value: string
}

/** Compact JSON array string exactly as Claude Desktop expects in inferenceModels. */
export function buildInferenceModelsJson() {
  return JSON.stringify(claudeModels)
}

export function buildRegistryValues(
  provider: ResolvedProvider,
  apiKey: string
): RegistryValue[] {
  return [
    { name: 'inferenceProvider', value: 'gateway' },
    { name: 'inferenceGatewayBaseUrl', value: provider.baseUrl },
    { name: 'inferenceGatewayAuthScheme', value: 'bearer' },
    { name: 'inferenceGatewayApiKey', value: apiKey },
    { name: 'modelDiscoveryEnabled', value: 'false' },
    { name: 'inferenceModels', value: buildInferenceModelsJson() }
  ]
}

function escapePsSingle(value: string) {
  return value.replace(/'/g, "''")
}

/**
 * Build a single PowerShell command that creates the policy key and writes all
 * six REG_SZ values. Uses New-Item + Set-ItemProperty (not `reg add`) so the
 * JSON-string inferenceModels value survives without cmd.exe quote mangling.
 */
export function buildWriteRegistryCommand(provider: ResolvedProvider, apiKey: string) {
  const values = buildRegistryValues(provider, apiKey)
  const lines = [
    `$key = '${CLAUDE_POLICY_KEY.replace('HKCU\\', 'HKCU:\\')}'`,
    "if (-not (Test-Path -LiteralPath $key)) { [void](New-Item -Path $key -Force) }"
  ]
  for (const { name, value } of values) {
    lines.push(
      `Set-ItemProperty -LiteralPath $key -Name '${escapePsSingle(name)}' -Value '${escapePsSingle(value)}' -Type String`
    )
  }
  // Post-write sanity check: inferenceModels must round-trip to a 7-item array.
  lines.push(
    "$stored = Get-ItemPropertyValue -LiteralPath $key -Name 'inferenceModels'",
    "if (-not $stored.TrimStart().StartsWith('[') -or @(($stored | ConvertFrom-Json)).Count -ne 7) { throw 'inferenceModels registry validation failed' }"
  )
  return lines.join('\n')
}
