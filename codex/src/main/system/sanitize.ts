const SECRET_PATTERNS = [
  /(OPENAI_API_KEY=)([^\s]+)/g,
  /(sk-[A-Za-z0-9_-]+)/g
]

export function maskSecrets(value: string) {
  return SECRET_PATTERNS.reduce((output, pattern) => {
    return output.replace(pattern, (_match, prefix?: string) => {
      if (prefix) {
        return `${prefix}***`
      }

      return 'sk-***'
    })
  }, value)
}
