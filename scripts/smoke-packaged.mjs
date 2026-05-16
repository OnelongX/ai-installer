import { spawn } from 'node:child_process'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '..')
const releaseDir = path.join(rootDir, 'release')
const smokeDir = path.join(releaseDir, 'smoke-test')
const reportPath = path.join(smokeDir, 'packaged-startup-report.json')
const reportTimeoutMs = 60000

function extractVersionSegments(name) {
  const match = name.match(/(\d+)\.(\d+)\.(\d+)/)

  if (!match) {
    return [0, 0, 0]
  }

  return match.slice(1).map((segment) => Number(segment))
}

function compareVersionDesc(left, right) {
  const leftSegments = extractVersionSegments(left)
  const rightSegments = extractVersionSegments(right)

  for (let index = 0; index < leftSegments.length; index += 1) {
    if (leftSegments[index] !== rightSegments[index]) {
      return rightSegments[index] - leftSegments[index]
    }
  }

  return right.localeCompare(left)
}

async function resolveExecutablePath() {
  if (process.argv[2]) {
    return process.argv[2]
  }

  const releaseEntries = await fs.readdir(releaseDir)
  const portableCandidates = releaseEntries
    .filter((entry) => entry.endsWith('.exe') && entry.includes('便携版'))
    .sort(compareVersionDesc)

  const portableName = portableCandidates[0]

  if (!portableName) {
    throw new Error(`未在 ${releaseDir} 中找到便携版 .exe 文件。`)
  }

  return path.join(releaseDir, portableName)
}

await fs.mkdir(smokeDir, { recursive: true })
await fs.rm(reportPath, { force: true })
await fs.rm(`${reportPath}.preload`, { force: true })

const executablePath = await resolveExecutablePath()

const exitCode = await new Promise((resolve, reject) => {
  const child = spawn(executablePath, [`--smoke-test-output=${reportPath}`], {
    cwd: rootDir,
    stdio: 'ignore',
    windowsHide: true
  })

  child.on('error', reject)
  child.on('close', resolve)
})

const deadline = Date.now() + reportTimeoutMs

while (Date.now() < deadline) {
  try {
    await fs.access(reportPath)
    break
  } catch {
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }
}

try {
  await fs.access(reportPath)
} catch {
  console.error('打包版自检失败：未在规定时间内生成报告文件。')
  console.error(JSON.stringify({ executablePath, exitCode, reportPath }, null, 2))
  process.exit(1)
}

const reportRaw = await fs.readFile(reportPath, 'utf8')
const report = JSON.parse(reportRaw)

if (exitCode !== 0 || report.status !== 'ready') {
  console.error('打包版自检失败。')
  console.error(JSON.stringify({ executablePath, exitCode, report }, null, 2))
  process.exit(1)
}

console.log(`打包版自检通过：${report.windowTitle} (${report.appVersion})`)
console.log(`可执行文件：${executablePath}`)
console.log(`报告文件：${reportPath}`)
