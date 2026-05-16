export const errorCategories = [
  'configuration',
  'dependency',
  'network',
  'path',
  'permission',
  'process',
  'validation'
] as const

export type InstallerErrorCategory = (typeof errorCategories)[number]

export interface InstallerError {
  category: InstallerErrorCategory
  message: string
  rawOutput?: string
  likelyCause?: string
  userAction?: string
  canRetry: boolean
  canResume: boolean
  requiresPrivilege: boolean
  docsLink?: string
}
