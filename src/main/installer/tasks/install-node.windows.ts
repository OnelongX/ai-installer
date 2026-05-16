export function getInstallNodeWindowsCommand() {
  return {
    args: [
      'install',
      'OpenJS.NodeJS.LTS',
      '--accept-package-agreements',
      '--accept-source-agreements'
    ],
    command: 'winget'
  }
}
