import { RangeSetBuilder } from '@codemirror/state'
import { Decoration, EditorView, ViewPlugin, WidgetType, type DecorationSet, type ViewUpdate } from '@codemirror/view'

export type SuperFlags = {
  bold?: boolean
  italic?: boolean
  strike?: boolean
  color?: string
  bg?: string
}

const SUPER_RE = /==(?:\[([^\]]*)\]((?:(?!==).)*?)|up((?:(?!==).)*?)|down((?:(?!==).)*?))==/g

export function safeColor(value: string): string | undefined {
  const v = value.trim()
  if (/^#[0-9a-fA-F]{3,8}$/.test(v)) return v
  if (/^[a-zA-Z]{1,22}$/.test(v)) return v
  return undefined
}

export function parseFlags(raw: string): SuperFlags {
  const flags: SuperFlags = {}
  for (const token of raw.trim().split(/\s+/).filter(Boolean)) {
    if (token === '-b') flags.bold = true
    else if (token === '-i') flags.italic = true
    else if (token === '-d') flags.strike = true
    else if (token === '-h') {
      flags.color ??= 'white'
      flags.bg ??= 'yellow'
    } else if (token.startsWith('-c=')) {
      const color = safeColor(token.slice(3))
      if (color) flags.color = color
    } else if (token.startsWith('-bgc=')) {
      const color = safeColor(token.slice(5))
      if (color) flags.bg = color
    }
  }
  return flags
}

function applyFlags(el: HTMLElement, flags: SuperFlags) {
  if (flags.bold) el.style.fontWeight = '700'
  if (flags.italic) el.style.fontStyle = 'italic'
  if (flags.strike) el.style.textDecoration = 'line-through'
  if (flags.color) el.style.color = flags.color
  if (flags.bg) {
    el.style.background = flags.bg
    el.style.borderRadius = '4px'
    el.style.padding = '0 0.22em'
  }
}

class HiddenWidget extends WidgetType {
  toDOM() {
    return document.createElement('span')
  }
  eq() {
    return true
  }
  ignoreEvent() {
    return true
  }
}

class StyledWidget extends WidgetType {
  text: string
  flags: SuperFlags
  constructor(text: string, flags: SuperFlags) {
    super()
    this.text = text
    this.flags = flags
  }
  eq(other: StyledWidget) {
    return this.text === other.text && JSON.stringify(this.flags) === JSON.stringify(other.flags)
  }
  toDOM() {
    const el = document.createElement('span')
    el.className = 'super-style'
    el.textContent = this.text
    applyFlags(el, this.flags)
    return el
  }
  ignoreEvent() {
    return false
  }
}

class ScriptWidget extends WidgetType {
  text: string
  kind: 'up' | 'down'
  constructor(text: string, kind: 'up' | 'down') {
    super()
    this.text = text
    this.kind = kind
  }
  eq(other: ScriptWidget) {
    return this.text === other.text && this.kind === other.kind
  }
  toDOM() {
    const el = document.createElement(this.kind === 'up' ? 'sup' : 'sub')
    el.className = this.kind === 'up' ? 'super-up' : 'super-down'
    el.textContent = this.text
    return el
  }
  ignoreEvent() {
    return false
  }
}

function selectionTouches(view: EditorView, from: number, to: number): boolean {
  return view.state.selection.ranges.some((range) => range.from <= to && range.to >= from)
}

function buildDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>()
  const hide = Decoration.replace({ widget: new HiddenWidget() })

  for (const { from, to } of view.visibleRanges) {
    const text = view.state.doc.sliceString(from, to)
    SUPER_RE.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = SUPER_RE.exec(text))) {
      const start = from + match.index
      const end = start + match[0].length
      if (selectionTouches(view, start, end)) continue

      if (match[1] != null) {
        const flags = parseFlags(match[1])
        const inner = match[2] ?? ''
        const openEnd = start + 4 + match[1].length
        builder.add(start, openEnd, hide)
        if (openEnd < end - 2) {
          builder.add(openEnd, end - 2, Decoration.replace({ widget: new StyledWidget(inner, flags) }))
        }
        builder.add(end - 2, end, hide)
      } else {
        const kind = match[3] != null ? 'up' : 'down'
        const inner = match[3] ?? match[4] ?? ''
        const openLen = kind === 'up' ? 4 : 6
        builder.add(start, start + openLen, hide)
        if (start + openLen < end - 2) {
          builder.add(start + openLen, end - 2, Decoration.replace({ widget: new ScriptWidget(inner, kind) }))
        }
        builder.add(end - 2, end, hide)
      }
    }
  }

  return builder.finish()
}

export const superSyntax = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet
    constructor(view: EditorView) {
      this.decorations = buildDecorations(view)
    }
    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged || update.selectionSet) {
        this.decorations = buildDecorations(update.view)
      }
    }
  },
  { decorations: (value) => value.decorations },
)
