export type YamlValue = string | number | boolean | null | YamlValue[] | { [key: string]: YamlValue }

export type FrontmatterDoc = {
  attrs: Record<string, YamlValue>
  body: string
  raw: string
  hasFence: boolean
}

const FENCE = /^---\s*$/

export function splitFrontmatter(content: string): FrontmatterDoc {
  const text = content.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n')
  const lines = text.split('\n')
  if (!FENCE.test(lines[0] ?? '')) {
    return { attrs: {}, body: text, raw: '', hasFence: false }
  }
  let end = -1
  for (let i = 1; i < lines.length; i++) {
    if (FENCE.test(lines[i])) {
      end = i
      break
    }
  }
  if (end < 0) return { attrs: {}, body: text, raw: '', hasFence: false }
  const raw = lines.slice(1, end).join('\n')
  const body = lines.slice(end + 1).join('\n').replace(/^\n/, '')
  return { attrs: parseYamlMap(raw), body, raw, hasFence: true }
}

export function parseYamlMap(src: string): Record<string, YamlValue> {
  const lines = src.replace(/\r\n/g, '\n').split('\n')
  const root: Record<string, YamlValue> = {}
  const stack: {
    indent: number
    target: Record<string, YamlValue> | YamlValue[]
    key?: string
    parent?: Record<string, YamlValue>
  }[] = [{ indent: -1, target: root }]

  for (const rawLine of lines) {
    if (!rawLine.trim() || rawLine.trimStart().startsWith('#')) continue
    const indent = rawLine.match(/^ */)![0].length
    const line = rawLine.slice(indent)
    while (stack.length > 1 && indent <= stack[stack.length - 1].indent) stack.pop()
    const parent = stack[stack.length - 1].target

    const listMatch = line.match(/^- (.*)$/)
    if (listMatch) {
      const itemRaw = listMatch[1]
      const frame = stack[stack.length - 1]
      let list = Array.isArray(parent) ? parent : null
      if (!list && frame.parent && frame.key) {
        list = []
        frame.parent[frame.key] = list
        frame.target = list
      }
      if (!list) continue
      const itemPair = itemRaw.match(/^([\w.-]+):\s*(.*)$/)
      if (itemPair && itemPair[2] === '') {
        const obj: Record<string, YamlValue> = {}
        list.push(obj)
        stack.push({ indent, target: obj })
      } else if (itemPair) {
        list.push({ [itemPair[1]]: parseScalar(itemPair[2]) })
      } else {
        list.push(parseScalar(itemRaw))
      }
      continue
    }

    const pair = line.match(/^([\w.-]+):\s*(.*)$/)
    if (!pair || Array.isArray(parent)) continue
    const key = pair[1]
    const rest = pair[2]
    if (rest === '|' || rest === '>') {
      parent[key] = ''
      continue
    }
    if (rest === '') {
      parent[key] = ''
      const nextList: YamlValue[] = []
      stack.push({ indent, target: nextList, key, parent })
      continue
    }
    parent[key] = parseScalar(rest)
  }

  return root
}

function parseScalar(raw: string): YamlValue {
  const v = raw.trim()
  if (v === 'true') return true
  if (v === 'false') return false
  if (v === 'null' || v === '~' || v === '') return null
  if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v)
  if (v.startsWith('[') && v.endsWith(']')) {
    return v
      .slice(1, -1)
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => parseScalar(item.replace(/^["']|["']$/g, '')))
  }
  return v.replace(/^["']|["']$/g, '')
}

export function stringifyFrontmatter(attrs: Record<string, YamlValue>): string {
  const body = Object.entries(attrs)
    .map(([key, value]) => dumpKey(key, value, 0))
    .join('\n')
  return `---\n${body}\n---\n`
}

function dumpKey(key: string, value: YamlValue, indent: number): string {
  const pad = '  '.repeat(indent)
  if (value === null) return `${pad}${key}:`
  if (Array.isArray(value)) {
    if (value.length === 0) return `${pad}${key}: []`
    if (value.every((item) => item === null || ['string', 'number', 'boolean'].includes(typeof item))) {
      return `${pad}${key}: [${value.map(dumpScalar).join(', ')}]`
    }
    const items = value
      .map((item) => {
        if (item && typeof item === 'object' && !Array.isArray(item)) {
          const keys = Object.keys(item)
          if (!keys.length) return `${pad}- {}`
          const [first, ...rest] = keys
          const head = `${pad}- ${first}: ${formatInline(item[first])}`
          const tail = rest.map((k) => `${pad}  ${k}: ${formatInline(item[k])}`)
          return [head, ...tail].join('\n')
        }
        return `${pad}- ${dumpScalar(item)}`
      })
      .join('\n')
    return `${pad}${key}:\n${items}`
  }
  if (typeof value === 'object') {
    const inner = Object.entries(value)
      .map(([k, v]) => dumpKey(k, v, indent + 1))
      .join('\n')
    return `${pad}${key}:\n${inner}`
  }
  return `${pad}${key}: ${dumpScalar(value)}`
}

function formatInline(value: YamlValue): string {
  if (value === null) return ''
  if (Array.isArray(value) || (typeof value === 'object' && value)) return dumpScalar(JSON.stringify(value))
  return dumpScalar(value)
}

function dumpScalar(value: YamlValue): string {
  if (typeof value === 'string') {
    if (value === '' || /[:#{}[\],&*?|<>=!%@\\]/.test(value) || value.includes('\n')) {
      return JSON.stringify(value)
    }
    return value
  }
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return 'null'
}

export function asString(value: YamlValue | undefined): string {
  if (value == null) return ''
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value)
  return ''
}

export function asStringList(value: YamlValue | undefined): string[] {
  if (!Array.isArray(value)) {
    const one = asString(value)
    return one ? [one] : []
  }
  return value.map((item) => asString(item)).filter(Boolean)
}

export function todayStamp(date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function compactStamp(date = new Date()): string {
  return todayStamp(date).replaceAll('-', '')
}

export function makeReadableId(type: string, date = new Date()): string {
  const rand = Math.random().toString(36).slice(2, 6)
  return `${compactStamp(date)}-${type}-${rand}`
}
