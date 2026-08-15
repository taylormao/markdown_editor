import { RangeSetBuilder } from '@codemirror/state'
import { Decoration, EditorView, ViewPlugin, WidgetType, type DecorationSet, type ViewUpdate } from '@codemirror/view'
import { renderMermaid } from '../lib/mermaid'

class MermaidWidget extends WidgetType {
  source: string
  constructor(source: string) {
    super()
    this.source = source
  }
  eq(other: MermaidWidget) {
    return this.source === other.source
  }
  toDOM() {
    const wrap = document.createElement('div')
    wrap.className = 'mermaid-frame mermaid-live'
    wrap.textContent = '正在绘制图表…'
    renderMermaid(this.source)
      .then((svg) => {
        wrap.innerHTML = svg
      })
      .catch((err: unknown) => {
        wrap.className = 'mermaid-error'
        wrap.textContent = err instanceof Error ? err.message : '图表无法渲染'
      })
    return wrap
  }
  ignoreEvent() {
    return false
  }
}

function collectFences(view: EditorView) {
  const hits: { from: number; to: number; source: string }[] = []
  let openFrom: number | null = null
  let bodyFrom = 0

  for (let i = 1; i <= view.state.doc.lines; i++) {
    const line = view.state.doc.line(i)
    if (openFrom == null) {
      if (/^```mermaid\s*$/i.test(line.text.trim())) {
        openFrom = line.from
        bodyFrom = line.to + 1
      }
    } else if (/^```\s*$/.test(line.text.trim())) {
      const end = Math.max(bodyFrom, line.from > 0 ? line.from - 1 : line.from)
      hits.push({
        from: openFrom,
        to: line.to,
        source: view.state.doc.sliceString(bodyFrom, end),
      })
      openFrom = null
    }
  }
  return hits
}

function selectionTouches(view: EditorView, from: number, to: number): boolean {
  return view.state.selection.ranges.some((range) => range.from <= to && range.to >= from)
}

function buildDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>()
  for (const fence of collectFences(view)) {
    if (selectionTouches(view, fence.from, fence.to)) continue
    builder.add(
      fence.from,
      fence.to,
      Decoration.replace({
        widget: new MermaidWidget(fence.source),
        block: true,
      }),
    )
  }
  return builder.finish()
}

export const mermaidSyntax = ViewPlugin.fromClass(
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
