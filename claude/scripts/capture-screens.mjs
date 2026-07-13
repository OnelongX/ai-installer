// Capture just the screens that changed in v0.1.6/0.1.7 (provider selector,
// detection, plan) — stops BEFORE 开始安装 so it never runs a real install.
//
//   node scripts/capture-screens.mjs "<exe>" "<out-dir>"
import { spawn } from 'node:child_process'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const exePath =
  process.argv[2] ?? path.join(rootDir, 'release', 'win-unpacked', 'Claude 安装器.exe')
const shotsDir = process.argv[3] ?? path.join(rootDir, 'docs', 'screenshots')
const fakeKey = 'sk-ant-demo-XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX01'
const port = 9455

await fs.mkdir(shotsDir, { recursive: true })
const child = spawn(exePath, [`--remote-debugging-port=${port}`], {
  detached: true,
  stdio: 'ignore'
})
child.unref()

async function waitTarget() {
  const deadline = Date.now() + 20_000
  while (Date.now() < deadline) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/json`)
      const t = await r.text()
      if (t.trim().startsWith('[')) {
        const p = JSON.parse(t).find((e) => e.type === 'page')
        if (p) return p
      }
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error('devtools target not reachable')
}

const target = await waitTarget()
const ws = new WebSocket(target.webSocketDebuggerUrl)
let id = 0
const send = (method, params = {}) =>
  new Promise((res, rej) => {
    const i = ++id
    const h = (ev) => {
      const m = JSON.parse(ev.data.toString())
      if (m.id === i) {
        ws.removeEventListener('message', h)
        m.error ? rej(new Error(m.error.message)) : res(m.result)
      }
    }
    ws.addEventListener('message', h)
    ws.send(JSON.stringify({ id: i, method, params }))
  })
await new Promise((r) => ws.addEventListener('open', r, { once: true }))
await send('Page.enable')
await send('Runtime.enable')

const evalJs = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? 'eval threw')
  return r.result.value
}
const shot = async (name) => {
  const { data } = await send('Page.captureScreenshot', { format: 'png' })
  await fs.writeFile(path.join(shotsDir, `${name}.png`), Buffer.from(data, 'base64'))
  console.log('saved', name)
}
const waitText = async (text, ms = 30_000) => {
  const deadline = Date.now() + ms
  while (Date.now() < deadline) {
    if (await evalJs(`document.body.innerText.includes(${JSON.stringify(text)})`)) return
    await new Promise((r) => setTimeout(r, 250))
  }
  throw new Error('timeout waiting for ' + text)
}
const clickText = async (text) => {
  const ok = await evalJs(`(function(){const b=[...document.querySelectorAll('button')].find(e=>e.textContent.trim()===${JSON.stringify(text)})||[...document.querySelectorAll('button')].find(e=>e.textContent.includes(${JSON.stringify(text)}));if(!b)return false;b.click();return true})()`)
  if (!ok) throw new Error('button not found: ' + text)
}

// 1. API key + provider selector
await waitText('API Key', 30_000)
await new Promise((r) => setTimeout(r, 800))
await evalJs(`(function(){const i=document.querySelector('input[type=password],input[type=text]');const set=Object.getOwnPropertyDescriptor(Object.getPrototypeOf(i),'value').set;set.call(i,${JSON.stringify(fakeKey)});i.dispatchEvent(new Event('input',{bubbles:true}));i.dispatchEvent(new Event('change',{bubbles:true}))})()`)
await new Promise((r) => setTimeout(r, 400))
await shot('02-api-key-filled')

await clickText('继续')

// 2. detection
await waitText('环境检测', 30_000)
await new Promise((r) => setTimeout(r, 1500))
await shot('03-detection')

await clickText('继续到安装计划')

// 3. plan (new tasks) — DO NOT click 开始安装
await waitText('安装计划', 30_000)
await new Promise((r) => setTimeout(r, 800))
await shot('04-plan')

console.log('done (stopped before install)')
ws.close()
process.exit(0)
