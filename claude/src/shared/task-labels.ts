const taskLabels = {
  'install-claude': '安装 Claude Code CLI',
  'install-node': '安装 Node.js',
  'persist-anthropic-api-key': '写入 ANTHROPIC_API_KEY',
  'verify-claude-runtime': '验证 Claude 运行环境',
  'write-config': '写入 Claude 配置'
} as const

export function getInstallerTaskLabel(taskId: string) {
  return taskLabels[taskId as keyof typeof taskLabels] ?? taskId
}

export function formatInstallerTaskList(taskIds: string[]) {
  return taskIds.map(getInstallerTaskLabel).join(', ')
}
