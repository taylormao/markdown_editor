import { RangeSetBuilder } from '@codemirror/state'
import { Decoration, EditorView, ViewPlugin, WidgetType, type DecorationSet, type ViewUpdate } from '@codemirror/view'
import { eachMath, renderMath } from '../lib/math'

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

class MathWidget extends WidgetType {
  tex: string
  display: boolean
  constructor(tex: string, display: boolean) {
    super()
    this.tex = tex
    this.display = display
  }
  eq(other: MathWidget) {
    return this.tex === other.tex && this.display === other.display
  }
  toDOM() {
    const el = document.createElement(this.display ? 'div' : 'span')
    el.className = this.display ? 'math-block' : 'math-inline'
    el.innerHTML = renderMath(this.tex, this.display)
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
    eachMath(text, (hit) => {
      const start = from + hit.from
      const end = from + hit.to
      if (selectionTouches(view, start, end)) return
      const open = hit.display ? 2 : 1
      builder.add(start, start + open, hide)
      if (start + open < end - open) {
        builder.add(start + open, end - open, Decoration.replace({ widget: new MathWidget(hit.tex, hit.display) }))
      }
      builder.add(end - open, end, hide)
    })
  }

  return builder.finish()
}

export const mathSyntax = ViewPlugin.fromClass(
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
