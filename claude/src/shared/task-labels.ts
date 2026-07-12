const taskLabels = {
  'clear-anthropic-oauth': '清除 Anthropic 官方 OAuth 凭据',
  'install-claude': '安装 Claude Code CLI',
  'install-node': '安装 Node.js',
  'persist-anthropic-api-key': '写入 ANTHROPIC_AUTH_TOKEN',
  'verify-gateway': '验证网关模型列表',
  'verify-claude-runtime': '验证 Claude 运行环境',
  'write-config': '写入 Claude Code 配置',
  'write-desktop-registry': '写入 Claude Desktop 配置'
} as const

export function getInstallerTaskLabel(taskId: string) {
  return taskLabels[taskId as keyof typeof taskLabels] ?? taskId
}

export function formatInstallerTaskList(taskIds: string[]) {
  return taskIds.map(getInstallerTaskLabel).join(', ')
}
