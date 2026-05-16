const taskLabels = {
  'install-codex': '安装 Codex CLI',
  'install-node': '安装 Node.js',
  'persist-openai-api-key': '写入 OPENAI_API_KEY',
  'verify-codex-runtime': '验证 Codex 运行环境',
  'write-config': '写入 Codex 配置'
} as const

export function getInstallerTaskLabel(taskId: string) {
  return taskLabels[taskId as keyof typeof taskLabels] ?? taskId
}

export function formatInstallerTaskList(taskIds: string[]) {
  return taskIds.map(getInstallerTaskLabel).join(', ')
}
