// Drive the packaged installer through every screen via Chrome DevTools
// Protocol and save a PNG for each step. Used by the docs / tutorial.
//
//   node scripts/capture-tutorial.mjs "<path-to-exe>" "<screenshot-dir>" "<api-key>"
//
// All three positional args are optional and default to the Claude build.
import { spawn } from 'node:child_process'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const rootDir = path.resolve(path.dirname(__filename), '..')

const exePath =
  process.argv[2] ??
  path.join(rootDir, 'release', 'win-unpacked', 'Claude 安装器.exe')
const shotsDir = process.argv[3] ?? path.join(rootDir, 'docs', 'screenshots')
const fakeKey = process.argv[4] ?? 'sk-ant-tutorial-DEMO-KEY-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA01'

const port = 9333

await fs.mkdir(shotsDir, { recursive: true })

console.log(`launching ${exePath}`)
const child = spawn(exePath, [`--remote-debugging-port=${port}`], {
  detached: true,
  stdio: 'ignore'
})
child.unref()

async function waitForTarget() {
  const deadline = Date.now() + 20_000
  let lastErr
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json`)
      const text = await response.text()
      if (text.trim().startsWith('[')) {
        const pages = JSON.parse(text)
        const target = pages.find((entry) => entry.type === 'page')
        if (target) return target
      }
    } catch (error) {
      lastErr = error
    }
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  throw new Error(`devtools target not reachable: ${lastErr?.message ?? 'timeout'}`)
}

const target = await waitForTarget()
console.log('connected to', target.url)

const ws = new WebSocket(target.webSocketDebuggerUrl)
let nextId = 0
const pending = new Map()
ws.onmessage = (event) => {
  const msg = JSON.parse(event.data.toString())
  if (msg.id != null && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id)
    pending.delete(msg.id)
    if (msg.error) reject(new Error(msg.error.message))
    else resolve(msg.result)
  }
}
await new Promise((resolve) => {
  ws.onopen = () => resolve()
})

function send(method, params = {}) {
  nextId += 1
  const id = nextId
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject })
    ws.send(JSON.stringify({ id, method, params }))
  })
}

async function evalJs(expression) {
  const result = await send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true
  })
  if (result.exceptionDetails) {
    throw new Error(
      result.exceptionDetails.exception?.description ?? 'eval threw'
    )
  }
  return result.result.value
}

async function screenshot(name) {
  const { data } = await send('Page.captureScreenshot', { format: 'png' })
  const out = path.join(shotsDir, `${name}.png`)
  await fs.writeFile(out, Buffer.from(data, 'base64'))
  console.log(`  saved ${out}`)
}

async function waitForSelector(selector, timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const found = await evalJs(`!!document.querySelector(${JSON.stringify(selector)})`)
    if (found) return true
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error(`timeout waiting for ${selector}`)
}

async function waitForText(text, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const found = await evalJs(`document.body.innerText.includes(${JSON.stringify(text)})`)
    if (found) return true
    await new Promise((resolve) => setTimeout(resolve, 300))
  }
  throw new Error(`timeout waiting for text: ${text}`)
}

async function clickByText(text) {
  const ok = await evalJs(`
    (function () {
      const candidates = [...document.querySelectorAll('button')]
      const btn = candidates.find((el) => el.textContent.trim() === ${JSON.stringify(text)})
        ?? candidates.find((el) => el.textContent.trim().includes(${JSON.stringify(text)}))
      if (!btn) return false
      btn.click()
      return true
    })()
  `)
  if (!ok) throw new Error(`button not found: ${text}`)
}

await send('Page.enable')
await send('Runtime.enable')

// 1. API Key screen
console.log('step 1: API key entry')
await waitForText('API Key', 30_000)
await new Promise((resolve) => setTimeout(resolve, 800))
await screenshot('01-api-key-empty')

// Fill the input via React-friendly native setter to ensure onChange fires.
await evalJs(`
  (function () {
    const input = document.querySelector('input[type=password], input[name="api-key"], input[type=text]')
    if (!input) throw new Error('no input found')
    const proto = Object.getPrototypeOf(input)
    const setter = Object.getOwnPropertyDescriptor(proto, 'value').set
    setter.call(input, ${JSON.stringify(fakeKey)})
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
  })()
`)
await new Promise((resolve) => setTimeout(resolve, 400))
await screenshot('02-api-key-filled')

await clickByText('继续')

// 2. Detection screen
console.log('step 2: environment detection')
await waitForText('环境检测', 30_000)
await new Promise((resolve) => setTimeout(resolve, 1500))
await screenshot('03-detection')

await clickByText('继续到安装计划')

// 3. Plan screen
console.log('step 3: install plan')
await waitForText('安装计划', 30_000)
await new Promise((resolve) => setTimeout(resolve, 800))
await screenshot('04-plan')

await clickByText('开始安装')

// 4. Execution screen
console.log('step 4: execution')
await waitForText('安装执行', 30_000)
await new Promise((resolve) => setTimeout(resolve, 1500))
await screenshot('05-execution')

// 5. Wait for completion
console.log('step 5: waiting for completion')
const finishedText = ['已可使用', '安装完成', '完成安装', '已完成']
const deadline = Date.now() + 120_000
let finished = false
while (Date.now() < deadline) {
  const matched = await evalJs(`(${JSON.stringify(finishedText)}).some((t) => document.body.innerText.includes(t))`)
  if (matched) {
    finished = true
    break
  }
  await new Promise((resolve) => setTimeout(resolve, 1000))
}
if (!finished) {
  console.warn('  did not reach completion within 120s; capturing anyway')
}
await new Promise((resolve) => setTimeout(resolve, 1500))
await screenshot('06-complete')

console.log('done')
ws.close()
process.exit(0)
