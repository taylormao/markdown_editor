import { RangeSetBuilder, StateField, type EditorState, type Transaction } from '@codemirror/state'
import { Decoration, EditorView, WidgetType, type DecorationSet } from '@codemirror/view'
import hljs from 'highlight.js/lib/common'
import { renderMermaid } from '../lib/mermaid'

type BlockHit = { from: number; to: number; kind: 'code' | 'table'; lang?: string; source: string }

function selectionInside(state: EditorState, from: number, to: number): boolean {
  return state.selection.ranges.some((range) => range.from > from && range.to < to)
}

function splitCells(line: string): string[] {
  return line
    .trim()
    .replace(/^\||\|$/g, '')
    .split('|')
    .map((cell) => cell.trim())
}

function isSepRow(line: string): boolean {
  return /^\s*\|?(\s*:?-{3,}:?\s*\|)+\s*:?-{3,}:?\s*\|?\s*$/.test(line)
}

function collectFences(state: EditorState): BlockHit[] {
  const hits: BlockHit[] = []
  let openFrom: number | null = null
  let bodyFrom = 0
  let lang = ''

  for (let i = 1; i <= state.doc.lines; i++) {
    const line = state.doc.line(i)
    if (openFrom == null) {
      const open = /^```([\w+-]*)\s*$/.exec(line.text.trim())
      if (open) {
        openFrom = line.from
        bodyFrom = line.to + 1
        lang = open[1] ?? ''
      }
    } else if (/^```\s*$/.test(line.text.trim())) {
      const end = Math.max(bodyFrom, line.from > 0 ? line.from - 1 : line.from)
      hits.push({
        from: openFrom,
        to: line.to,
        kind: 'code',
        lang,
        source: state.doc.sliceString(bodyFrom, end),
      })
      openFrom = null
    }
  }
  return hits
}

function collectTables(state: EditorState): BlockHit[] {
  const hits: BlockHit[] = []
  const doc = state.doc
  let i = 1
  while (i < doc.lines) {
    const line = doc.line(i)
    const next = doc.line(i + 1)
    if (line.text.includes('|') && isSepRow(next.text)) {
      const start = i
      i += 2
      while (i <= doc.lines) {
        const row = doc.line(i)
        if (!row.text.includes('|') || !row.text.trim()) break
        i += 1
      }
      const last = doc.line(i - 1)
      hits.push({
        from: doc.line(start).from,
        to: last.to,
        kind: 'table',
        source: doc.sliceString(doc.line(start).from, last.to),
      })
      continue
    }
    i += 1
  }
  return hits
}

class LiveWidget extends WidgetType {
  hit: BlockHit
  constructor(hit: BlockHit) {
    super()
    this.hit = hit
  }
  eq(other: LiveWidget) {
    return this.hit.kind === other.hit.kind && this.hit.lang === other.hit.lang && this.hit.source === other.hit.source
  }
  toDOM() {
    const wrap = document.createElement('div')
    wrap.className = 'live-block'
    wrap.addEventListener('mousedown', (event) => {
      event.preventDefault()
      const view = EditorView.findFromDOM(wrap)
      if (!view) return
      view.dispatch({ selection: { anchor: this.hit.from + 1 } })
      view.focus()
    })

    if (this.hit.kind === 'table') {
      wrap.append(renderTable(this.hit.source))
      return wrap
    }

    if ((this.hit.lang ?? '').toLowerCase() === 'mermaid') {
      wrap.classList.add('mermaid-frame', 'mermaid-live')
      wrap.textContent = '正在绘制图表…'
      renderMermaid(this.hit.source)
        .then((svg) => {
          wrap.innerHTML = svg
        })
        .catch((err: unknown) => {
          wrap.className = 'mermaid-error'
          wrap.textContent = err instanceof Error ? err.message : '图表无法渲染'
        })
      return wrap
    }

    wrap.append(renderCode(this.hit.lang ?? '', this.hit.source))
    return wrap
  }
  ignoreEvent() {
    return false
  }
}

function renderTable(source: string): HTMLTableElement {
  const lines = source.split('\n').filter((line) => line.trim())
  const headers = splitCells(lines[0] ?? '')
  const rows = lines.slice(2).map(splitCells)
  const table = document.createElement('table')
  table.className = 'live-table'
  const thead = document.createElement('thead')
  const headRow = document.createElement('tr')
  headers.forEach((cell) => {
    const th = document.createElement('th')
    th.textContent = cell
    headRow.append(th)
  })
  thead.append(headRow)
  table.append(thead)
  const tbody = document.createElement('tbody')
  rows.forEach((row) => {
    const tr = document.createElement('tr')
    row.forEach((cell) => {
      const td = document.createElement('td')
      td.textContent = cell
      tr.append(td)
    })
    tbody.append(tr)
  })
  table.append(tbody)
  return table
}

function renderCode(lang: string, source: string): HTMLPreElement {
  const pre = document.createElement('pre')
  pre.className = 'code-block live-code'
  if (lang) {
    const badge = document.createElement('span')
    badge.className = 'code-lang'
    badge.textContent = lang
    pre.append(badge)
  }
  const code = document.createElement('code')
  try {
    code.innerHTML = lang && hljs.getLanguage(lang) ? hljs.highlight(source, { language: lang }).value : hljs.highlightAuto(source).value
  } catch {
    code.textContent = source
  }
  pre.append(code)
  return pre
}

function buildDecorations(state: EditorState): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>()
  const blocks = [...collectFences(state), ...collectTables(state)].sort((a, b) => a.from - b.from)
  for (const hit of blocks) {
    if (selectionInside(state, hit.from, hit.to)) continue
    builder.add(
      hit.from,
      hit.to,
      Decoration.replace({
        widget: new LiveWidget(hit),
        block: true,
      }),
    )
  }
  return builder.finish()
}

export const liveBlocks = StateField.define<DecorationSet>({
  create(state) {
    return buildDecorations(state)
  },
  update(decorations: DecorationSet, transaction: Transaction) {
    if (!transaction.docChanged && !transaction.selection) return decorations
    return buildDecorations(transaction.state)
  },
  provide: (field) => EditorView.decorations.from(field),
})
