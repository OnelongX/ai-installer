import { spawn, type SpawnOptions } from 'node:child_process'
import path from 'node:path'

import { maskSecrets } from './sanitize'
import {
  endsWithWindowsShellExtension,
  getCommandInvocations,
  hasPathSeparator,
  type CommandInvocation
} from './windows-command'

export interface CommandResult {
  exitCode: number
  stdout: string
  stderr: string
}

export const DEFAULT_TIMEOUT_MS = 30_000

function quoteForCmd(value: string) {
  return /\s/.test(value) ? `"${value}"` : value
}

function getComSpec() {
  if (process.env.ComSpec) {
    return process.env.ComSpec
  }

  const systemRoot = process.env.SystemRoot ?? 'C:\\Windows'
  return path.join(systemRoot, 'System32', 'cmd.exe')
}

function executeInvocation(invocation: CommandInvocation, timeoutMs: number) {
  return new Promise<CommandResult>((resolve, reject) => {
    let command = invocation.command
    let args = invocation.args
    const spawnOptions: SpawnOptions = { windowsHide: true }

    if (process.platform === 'win32' && invocation.shell) {
      // Node's `shell: true` does NOT auto-quote the command on Windows, so
      // any path containing a space (e.g. C:\Program Files\nodejs\npm.cmd)
      // breaks with "'C:\Program' is not recognized". We build the command
      // line ourselves and use windowsVerbatimArguments to bypass Node's
      // argv munging. `chcp 65001` forces the child console to UTF-8 so
      // error messages don't come back as GBK mojibake on zh-CN systems.
      const quotedCmd = quoteForCmd(invocation.command)
      const quotedArgs = invocation.args.map(quoteForCmd).join(' ')
      const tail = quotedArgs ? `${quotedCmd} ${quotedArgs}` : quotedCmd

      command = getComSpec()
      args = ['/d', '/s', '/c', `chcp 65001>nul & ${tail}`]
      spawnOptions.windowsVerbatimArguments = true
      spawnOptions.shell = false
    } else {
      spawnOptions.shell = invocation.shell
    }

    const child = spawn(command, args, spawnOptions)

    let stdout = ''
    let stderr = ''

    const timeout = setTimeout(() => {
      child.kill()
      reject(new Error(`Command timed out after ${timeoutMs}ms`))
    }, timeoutMs)

    child.stdout?.on('data', (chunk) => {
      stdout += chunk.toString('utf8')
    })

    child.stderr?.on('data', (chunk) => {
      stderr += chunk.toString('utf8')
    })

    child.on('error', (error) => {
      clearTimeout(timeout)
      reject(error)
    })

    child.on('close', (code) => {
      clearTimeout(timeout)
      resolve({
        exitCode: code ?? 0,
        stderr: maskSecrets(stderr),
        stdout: maskSecrets(stdout)
      })
    })
  })
}

function shouldRetryWithFallback(error: unknown) {
  if (!(error instanceof Error)) {
    return false
  }

  const errorCode = 'code' in error ? String(error.code) : ''
  return errorCode === 'ENOENT' || errorCode === 'EINVAL' || errorCode === 'EPERM'
}

const WHERE_TIMEOUT_MS = 5_000

// Last-resort lookup that asks Windows where a command lives in the current
// process PATH (which we refresh from the registry after install-node). This
// catches Node installs that don't sit at any of the well-known paths in
// windows-command.ts — custom drives, nvm-windows, etc.
async function locateOnWindowsPath(commandName: string): Promise<string | null> {
  if (process.platform !== 'win32') {
    return null
  }

  const systemRoot = process.env.SystemRoot ?? 'C:\\Windows'
  const wherePath = path.join(systemRoot, 'System32', 'where.exe')

  return new Promise((resolve) => {
    const child = spawn(wherePath, [commandName], { windowsHide: true })
    let stdout = ''
    const timeout = setTimeout(() => {
      child.kill()
      resolve(null)
    }, WHERE_TIMEOUT_MS)

    child.stdout?.on('data', (chunk) => {
      stdout += chunk.toString('utf8')
    })
    child.on('error', () => {
      clearTimeout(timeout)
      resolve(null)
    })
    child.on('close', (code) => {
      clearTimeout(timeout)

      if (code !== 0) {
        resolve(null)
        return
      }

      const first = stdout
        .split(/\r?\n/)
        .map((line) => line.trim())
        .find((line) => line.length > 0)

      resolve(first ?? null)
    })
  })
}

export async function runCommand(
  command: string,
  args: string[] = [],
  timeoutMs: number = DEFAULT_TIMEOUT_MS
) {
  const invocations = getCommandInvocations(command, args)
  let lastError: unknown

  for (const invocation of invocations) {
    try {
      return await executeInvocation(invocation, timeoutMs)
    } catch (error) {
      lastError = error

      if (!shouldRetryWithFallback(error)) {
        throw error
      }
    }
  }

  if (process.platform === 'win32' && !hasPathSeparator(command)) {
    const located = await locateOnWindowsPath(command)

    if (located) {
      const invocation: CommandInvocation = {
        args,
        command: located,
        shell: endsWithWindowsShellExtension(located)
      }

      return executeInvocation(invocation, timeoutMs)
    }
  }

  throw lastError ?? new Error(`Unable to start command: ${command}`)
}
