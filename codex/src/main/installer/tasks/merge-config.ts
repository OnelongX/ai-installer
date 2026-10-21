// Line-based merge for ~/.codex/config.toml.
//
// The installer only owns the keys it renders. On a reinstall everything else
// the user (or Codex itself) put in config.toml — mcp_servers, plugins,
// projects, marketplaces, desktop preferences, notify, … — must survive.
//
// Rules:
//   - keys the installer renders win over the same key in the existing file
//   - keys / tables only present in the existing file are kept as-is
//   - tables listed in `replaceTables` are owned outright (existing keys dropped)
//
// This is not a full TOML parser: it groups lines into tables and `key = value`
// entries, following multi-line arrays / inline tables / multi-line strings so a
// value spanning several lines stays in one piece. install_codex.sh embeds the
// same algorithm in JS; tests/unit/merge-config.test.ts checks they agree.

interface TomlEntry {
  key: string | null
  lines: string[]
}

interface TomlTable {
  arrayTable: boolean
  entries: TomlEntry[]
  header: string | null
  name: string
}

interface ScanState {
  depth: number
  multiline: string | null
}

const HEADER = /^\s*(\[\[?)\s*([^\]]+?)\s*\]\]?\s*(#.*)?$/
const KEY = /^\s*("(?:[^"\\]|\\.)*"|'[^']*'|[A-Za-z0-9_.-]+)\s*=/

function unquote(key: string) {
  return key.startsWith('"') || key.startsWith("'") ? key.slice(1, -1) : key
}

// Track bracket depth and open multi-line strings so continuation lines of a
// value aren't mistaken for headers or new keys.
function scan(text: string, state: ScanState) {
  let i = 0
  while (i < text.length) {
    if (state.multiline) {
      const end = text.indexOf(state.multiline, i)
      if (end === -1) return
      i = end + 3
      state.multiline = null
      continue
    }
    const ch = text[i]
    if (ch === '#') return
    if (text.startsWith('"""', i) || text.startsWith("'''", i)) {
      state.multiline = text.slice(i, i + 3)
      i += 3
      continue
    }
    if (ch === '"') {
      i++
      while (i < text.length && text[i] !== '"') {
        if (text[i] === '\\') i++
        i++
      }
      i++
      continue
    }
    if (ch === "'") {
      const end = text.indexOf("'", i + 1)
      i = end === -1 ? text.length : end + 1
      continue
    }
    if (ch === '[' || ch === '{') state.depth++
    else if (ch === ']' || ch === '}') state.depth--
    i++
  }
}

export function parseTomlTables(text: string): TomlTable[] {
  const tables: TomlTable[] = [{ arrayTable: false, entries: [], header: null, name: '' }]
  const state: ScanState = { depth: 0, multiline: null }
  let open: TomlEntry | null = null

  for (const line of text.split(/\r?\n/)) {
    if (open) {
      open.lines.push(line)
      scan(line, state)
      if (!state.multiline && state.depth <= 0) {
        open = null
        state.depth = 0
      }
      continue
    }

    const header = HEADER.exec(line)
    if (header) {
      tables.push({ arrayTable: header[1] === '[[', entries: [], header: line, name: header[2] })
      continue
    }

    const key = KEY.exec(line)
    const entry: TomlEntry = { key: key ? unquote(key[1]) : null, lines: [line] }
    tables[tables.length - 1].entries.push(entry)
    if (key) {
      scan(line.slice(key[0].length), state)
      if (state.multiline || state.depth > 0) open = entry
      else state.depth = 0
    }
  }

  return tables
}

function trimBlankEdges(lines: string[]) {
  let start = 0
  let end = lines.length
  while (start < end && !lines[start].trim()) start++
  while (end > start && !lines[end - 1].trim()) end--
  return lines.slice(start, end).map((line) => line.trimEnd())
}

function tableLines(table: TomlTable, extras: TomlEntry[] = []) {
  const body = [...table.entries, ...extras].flatMap((entry) => entry.lines)
  return trimBlankEdges(table.header ? [table.header, ...body] : body)
}

export function mergeConfigToml(
  rendered: string,
  existing: string | null | undefined,
  options: { replaceTables?: string[] } = {}
) {
  if (!existing?.trim()) {
    return rendered
  }

  const replace = new Set(options.replaceTables ?? [])
  const ours = parseTomlTables(rendered)
  const theirs = parseTomlTables(existing)
  const oursByName = new Map(ours.filter((t) => !t.arrayTable).map((t) => [t.name, t]))
  const emitted = new Set<TomlTable>()

  // Existing keys the installer doesn't render. Comments / blank lines inside a
  // merged table are dropped: they may describe a key we just overrode.
  const extrasFor = (mine: TomlTable, other: TomlTable) => {
    if (replace.has(mine.name)) return []
    const owned = new Set(mine.entries.map((entry) => entry.key).filter(Boolean))
    return other.entries.filter((entry) => entry.key && !owned.has(entry.key))
  }

  const blocks: string[][] = []
  for (const table of theirs) {
    const mine = table.arrayTable ? undefined : oursByName.get(table.name)
    if (mine && !emitted.has(mine)) {
      emitted.add(mine)
      blocks.push(tableLines(mine, extrasFor(mine, table)))
    } else if (!mine) {
      blocks.push(tableLines(table))
    }
  }
  for (const table of ours) {
    if (!emitted.has(table)) blocks.push(tableLines(table))
  }

  return blocks
    .filter((block) => block.length)
    .map((block) => block.join('\n'))
    .join('\n\n')
}
