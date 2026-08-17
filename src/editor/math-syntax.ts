import { RangeSetBuilder, StateField, type EditorState, type Transaction } from '@codemirror/state'
import { Decoration, EditorView, WidgetType, type DecorationSet } from '@codemirror/view'
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

function selectionInside(state: EditorState, from: number, to: number): boolean {
  return state.selection.ranges.some((range) => range.from > from && range.to < to)
}

function buildDecorations(state: EditorState): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>()
  const hide = Decoration.replace({ widget: new HiddenWidget() })

  const text = state.doc.toString()
  eachMath(text, (hit) => {
    const start = hit.from
    const end = hit.to
    if (selectionInside(state, start, end)) return
    const open = hit.display ? 2 : 1
    builder.add(start, start + open, hide)
    if (start + open < end - open) {
      builder.add(start + open, end - open, Decoration.replace({ widget: new MathWidget(hit.tex, hit.display) }))
    }
    builder.add(end - open, end, hide)
  })

  return builder.finish()
}

export const mathSyntax = StateField.define<DecorationSet>({
  create(state) {
    return buildDecorations(state)
  },
  update(decorations: DecorationSet, transaction: Transaction) {
    if (!transaction.docChanged && !transaction.selection) return decorations
    return buildDecorations(transaction.state)
  },
  provide: (field) => EditorView.decorations.from(field),
})
