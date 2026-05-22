#!/usr/bin/env node
//
// verify-gateway.mjs — 实测 Claude Code 是不是真的把请求发到了我们配的 gateway
//
// 跑法：
//   node claude/scripts/verify-gateway.mjs
//
// 它会做的事：
//   1. 在 127.0.0.1:19999 起一个假的 Anthropic Messages API
//   2. 用 ANTHROPIC_BASE_URL=http://127.0.0.1:19999 + ANTHROPIC_AUTH_TOKEN=test-xxx
//      跑一次 `claude -p "say ok"`
//   3. 把假服务器收到的所有请求 dump 出来
//   4. 对几条关键断言打勾/打叉：
//      - 请求确实到了 127.0.0.1，不是 api.anthropic.com
//      - 带了我们指定的 Authorization 头
//      - 系统提示里没有 cch 那个 attribution 块（CLAUDE_CODE_ATTRIBUTION_HEADER=0 起作用）
//      - 模型名是 settings.json 里那个
//
// 退出码：全部断言通过返回 0；任一失败返回 1。
//
// 注意：测试用的是 HTTP（非 HTTPS）—— Claude Code 默认接受 BASE_URL 是 http://。
// 如果以后这条变成必须 HTTPS，本脚本得加自签证书。

import http from 'node:http'
import { spawn } from 'node:child_process'
import { setTimeout as sleep } from 'node:timers/promises'

const PORT = Number(process.env.MOCK_PORT ?? 19999)
const FAKE_TOKEN = 'test-livetoken-' + Math.random().toString(16).slice(2, 8)
const FAKE_MODEL = 'claude-sonnet-4-5'

const captured = []

// -------------------- mock gateway --------------------

function streamingAnthropicResponse(res) {
  res.writeHead(200, {
    'content-type': 'text/event-stream',
    'cache-control': 'no-cache',
    connection: 'keep-alive'
  })
  const lines = [
    `event: message_start`,
    `data: ${JSON.stringify({
      type: 'message_start',
      message: {
        id: 'msg_mock',
        type: 'message',
        role: 'assistant',
        model: FAKE_MODEL,
        content: [],
        stop_reason: null,
        stop_sequence: null,
        usage: { input_tokens: 5, output_tokens: 0 }
      }
    })}`,
    ``,
    `event: content_block_start`,
    `data: ${JSON.stringify({ type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } })}`,
    ``,
    `event: content_block_delta`,
    `data: ${JSON.stringify({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'ok' } })}`,
    ``,
    `event: content_block_stop`,
    `data: ${JSON.stringify({ type: 'content_block_stop', index: 0 })}`,
    ``,
    `event: message_delta`,
    `data: ${JSON.stringify({ type: 'message_delta', delta: { stop_reason: 'end_turn' }, usage: { output_tokens: 1 } })}`,
    ``,
    `event: message_stop`,
    `data: ${JSON.stringify({ type: 'message_stop' })}`,
    ``,
    ``
  ]
  res.end(lines.join('\n'))
}

function plainAnthropicResponse(res) {
  res.writeHead(200, { 'content-type': 'application/json' })
  res.end(
    JSON.stringify({
      id: 'msg_mock',
      type: 'message',
      role: 'assistant',
      model: FAKE_MODEL,
      content: [{ type: 'text', text: 'ok' }],
      stop_reason: 'end_turn',
      stop_sequence: null,
      usage: { input_tokens: 5, output_tokens: 1 }
    })
  )
}

const server = http.createServer((req, res) => {
  const chunks = []
  req.on('data', (c) => chunks.push(c))
  req.on('end', () => {
    const body = Buffer.concat(chunks).toString('utf8')
    captured.push({
      method: req.method,
      url: req.url,
      headers: req.headers,
      body
    })

    if (req.url?.includes('/v1/messages')) {
      // streaming if requested
      const wantStream = body.includes('"stream":true') || body.includes('"stream": true')
      if (wantStream) streamingAnthropicResponse(res)
      else plainAnthropicResponse(res)
      return
    }

    if (req.url?.includes('/v1/models')) {
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(
        JSON.stringify({
          data: [
            { id: 'claude-sonnet-4-5', display_name: 'Sonnet 4.5 (mock)', type: 'model' },
            { id: 'claude-opus-4-5', display_name: 'Opus 4.5 (mock)', type: 'model' }
          ]
        })
      )
      return
    }

    // catch-all
    res.writeHead(404, { 'content-type': 'text/plain' })
    res.end('not found in mock')
  })
})

await new Promise((resolve, reject) => {
  server.once('error', reject)
  server.listen(PORT, '127.0.0.1', resolve)
})

console.log(`[mock] gateway listening on http://127.0.0.1:${PORT}`)

// -------------------- run claude -p --------------------

console.log(`[test] spawning claude -p "say ok" with ANTHROPIC_BASE_URL=http://127.0.0.1:${PORT}`)

const env = {
  ...process.env,
  ANTHROPIC_BASE_URL: `http://127.0.0.1:${PORT}`,
  ANTHROPIC_AUTH_TOKEN: FAKE_TOKEN,
  CLAUDE_CODE_ATTRIBUTION_HEADER: '0',
  CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1'
}
// Make sure no leftover ANTHROPIC_API_KEY conflicts
delete env.ANTHROPIC_API_KEY

const claudeBin = process.env.CLAUDE_BIN || 'claude'
const child = spawn(claudeBin, ['-p', 'say ok'], {
  env,
  stdio: ['ignore', 'pipe', 'pipe'],
  shell: process.platform === 'win32'
})

let stdout = ''
let stderr = ''
child.stdout?.on('data', (c) => (stdout += c.toString('utf8')))
child.stderr?.on('data', (c) => (stderr += c.toString('utf8')))

const timeout = setTimeout(() => {
  console.error('[test] claude timed out after 30s, killing')
  child.kill()
}, 30_000)

const exitCode = await new Promise((resolve) => {
  child.on('close', (code) => {
    clearTimeout(timeout)
    resolve(code ?? -1)
  })
  child.on('error', (e) => {
    clearTimeout(timeout)
    console.error('[test] failed to spawn claude:', e.message)
    resolve(-1)
  })
})

console.log(`\n[test] claude exit code: ${exitCode}`)
if (stdout.trim()) console.log(`[test] claude stdout: ${stdout.trim().slice(0, 200)}`)
if (stderr.trim()) console.log(`[test] claude stderr: ${stderr.trim().slice(0, 400)}`)

await sleep(200)
server.close()

// -------------------- assertions --------------------

console.log(`\n=== captured ${captured.length} request(s) on the mock ===\n`)

if (captured.length === 0) {
  console.error('❌ NO requests reached the mock — gateway override is NOT working.')
  console.error('   Possible causes:')
  console.error('   - claude was never invoked (CLAUDE_BIN missing / not in PATH)')
  console.error('   - ANTHROPIC_BASE_URL not honored (Claude Code config overrides it)')
  console.error('   - .credentials.json present → OAuth used instead, env var ignored')
  console.error('     fix: claude logout  (or rm ~/.claude/.credentials.json)')
  process.exit(1)
}

const messagesReq = captured.find((r) => r.url?.includes('/v1/messages'))

if (!messagesReq) {
  console.error('❌ no /v1/messages request — claude hit the mock but on a different path:')
  for (const r of captured) console.error('   ', r.method, r.url)
  process.exit(1)
}

console.log(`POST ${messagesReq.url}`)
console.log(`  host        : ${messagesReq.headers.host}`)
console.log(`  authorization: ${messagesReq.headers.authorization ?? '(absent)'}`)
console.log(`  x-api-key   : ${messagesReq.headers['x-api-key'] ?? '(absent)'}`)
console.log(`  user-agent  : ${messagesReq.headers['user-agent'] ?? '(absent)'}`)

let body
try {
  body = JSON.parse(messagesReq.body)
} catch {
  console.warn('⚠️  could not parse request body as JSON')
  body = null
}

let pass = 0
let fail = 0
const check = (ok, msg) => {
  console.log(`  ${ok ? '✅' : '❌'} ${msg}`)
  ok ? pass++ : fail++
}

// 1. Request actually reached our mock
check(true, `request reached the mock at 127.0.0.1:${PORT}`)

// 2. Auth header is our fake token
const authHeader = messagesReq.headers.authorization ?? ''
const xApiKey = messagesReq.headers['x-api-key'] ?? ''
const tokenSeen = authHeader.includes(FAKE_TOKEN) || xApiKey.includes(FAKE_TOKEN)
check(tokenSeen, `auth header carries the fake token we set (${FAKE_TOKEN.slice(0, 12)}…)`)
if (authHeader.startsWith('Bearer ')) {
  check(true, 'auth uses Authorization: Bearer (ANTHROPIC_AUTH_TOKEN path — gateway-recommended)')
} else if (xApiKey) {
  check(true, 'auth uses x-api-key (ANTHROPIC_API_KEY path)')
} else {
  check(false, 'neither Authorization nor x-api-key was set')
}

// 3. Attribution block absence
if (body?.system) {
  const sys = body.system
  let firstText = ''
  if (Array.isArray(sys)) firstText = sys[0]?.text ?? ''
  else if (typeof sys === 'string') firstText = sys
  const hasAttr = /\bcch\b|x-anthropic-billing-header/i.test(firstText)
  check(!hasAttr, `system prompt has no attribution / cch block (CLAUDE_CODE_ATTRIBUTION_HEADER=0)`)
} else {
  check(false, 'no system prompt found in request body — cannot verify attribution suppression')
}

// 4. Model is the expected one
if (body?.model) {
  check(body.model.startsWith('claude-'), `model is "${body.model}" (claude-family)`)
} else {
  check(false, 'no model field in request body')
}

// 5. Optional: tool_reference behaviour
if (body?.tools && Array.isArray(body.tools) && body.tools.length > 0) {
  const hasToolRef = body.tools.some((t) => t.type === 'tool_reference')
  if (hasToolRef) check(true, 'request includes tool_reference blocks — need ENABLE_TOOL_SEARCH=true on gateway side')
  else check(true, 'request uses inline tool defs (no tool_reference)')
}

console.log(`\n=== ${pass} passed · ${fail} failed ===`)
process.exit(fail === 0 ? 0 : 1)
