import path from 'node:path'

import { describe, expect, it } from 'vitest'
import {
  getCommandInvocations,
  getKnownWindowsCommandPaths
} from '../../src/main/system/windows-command'

describe('windows command resolution', () => {
  it('finds Node.js in the common Program Files install location', () => {
    const env = {
      LOCALAPPDATA: 'C:\\Users\\Administrator\\AppData\\Local',
      ProgramFiles: 'C:\\Program Files',
      ProgramFiles_x86: 'C:\\Program Files (x86)'
    }

    const paths = getKnownWindowsCommandPaths('node', env, (candidate) => {
      return candidate === path.join('C:\\Program Files', 'nodejs', 'node.exe')
    })

    expect(paths).toEqual([path.join('C:\\Program Files', 'nodejs', 'node.exe')])
  })

  it('finds the npm-installed Claude shim in AppData', () => {
    const env = {
      APPDATA: 'C:\\Users\\Administrator\\AppData\\Roaming',
      LOCALAPPDATA: 'C:\\Users\\Administrator\\AppData\\Local'
    }

    const paths = getKnownWindowsCommandPaths('claude', env, (candidate) => {
      return candidate === path.join(env.APPDATA, 'npm', 'claude.cmd')
    })

    expect(paths).toEqual([path.join(env.APPDATA, 'npm', 'claude.cmd')])
  })

  it('marks cmd shims to run through the Windows shell', () => {
    const env = {
      APPDATA: 'C:\\Users\\Administrator\\AppData\\Roaming'
    }

    const invocations = getCommandInvocations('claude', ['--version'], 'win32', env, (candidate) => {
      return candidate === path.join(env.APPDATA, 'npm', 'claude.cmd')
    })

    expect(invocations).toEqual([
      {
        args: ['--version'],
        command: 'claude',
        shell: false
      },
      {
        args: ['--version'],
        command: 'claude',
        shell: true
      },
      {
        args: ['--version'],
        command: path.join(env.APPDATA, 'npm', 'claude.cmd'),
        shell: true
      }
    ])
  })

  it('falls back to a shell-resolved bare command when no static path matches', () => {
    const env = {
      APPDATA: 'C:\\Users\\Administrator\\AppData\\Roaming',
      LOCALAPPDATA: 'C:\\Users\\Administrator\\AppData\\Local',
      ProgramFiles: 'C:\\Program Files'
    }

    // npm is installed somewhere else (e.g. nvm-windows or a custom drive).
    // None of the well-known fallback paths exist on this filesystem, but
    // the bare command should still be re-attempted via cmd.exe so PATH +
    // PATHEXT can resolve it.
    const invocations = getCommandInvocations('npm', ['-v'], 'win32', env, () => false)

    expect(invocations).toEqual([
      { args: ['-v'], command: 'npm', shell: false },
      { args: ['-v'], command: 'npm', shell: true }
    ])
  })

  it('finds npm in the user-scope nodejs install location', () => {
    const env = {
      LOCALAPPDATA: 'C:\\Users\\Administrator\\AppData\\Local'
    }

    const expected = path.join(env.LOCALAPPDATA, 'Programs', 'nodejs', 'npm.cmd')
    const paths = getKnownWindowsCommandPaths('npm', env, (candidate) => candidate === expected)

    expect(paths).toEqual([expected])
  })

  it('finds npm in the npm prefix directory', () => {
    const env = {
      APPDATA: 'C:\\Users\\Administrator\\AppData\\Roaming'
    }

    const expected = path.join(env.APPDATA, 'npm', 'npm.cmd')
    const paths = getKnownWindowsCommandPaths('npm', env, (candidate) => candidate === expected)

    expect(paths).toEqual([expected])
  })

  it('finds winget in the WindowsApps location', () => {
    const env = {
      LOCALAPPDATA: 'C:\\Users\\Administrator\\AppData\\Local'
    }

    const paths = getKnownWindowsCommandPaths('winget', env, (candidate) => {
      return candidate === path.join(env.LOCALAPPDATA, 'Microsoft', 'WindowsApps', 'winget.exe')
    })

    expect(paths).toEqual([
      path.join(env.LOCALAPPDATA, 'Microsoft', 'WindowsApps', 'winget.exe')
    ])
  })
})
