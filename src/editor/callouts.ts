import { RangeSetBuilder } from '@codemirror/state'
import { Decoration, EditorView, ViewPlugin, type DecorationSet, type ViewUpdate } from '@codemirror/view'

const HEAD = /^>\s*\[!(NOTE|INFO|TIP|WARNING|ERROR|DANGER)\]/i

function build(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>()
  let kind: string | null = null

  for (let i = 1; i <= view.state.doc.lines; i++) {
    const line = view.state.doc.line(i)
    const head = HEAD.exec(line.text)
    if (head) {
      kind = head[1].toLowerCase()
      builder.add(line.from, line.from, Decoration.line({ class: `cm-callout cm-callout-${kind} cm-callout-head` }))
      continue
    }
    if (kind && /^>\s?/.test(line.text)) {
      builder.add(line.from, line.from, Decoration.line({ class: `cm-callout cm-callout-${kind}` }))
    } else {
      kind = null
    }
  }

  return builder.finish()
}

export const calloutDecor = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet
    constructor(view: EditorView) {
      this.decorations = build(view)
    }
    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) this.decorations = build(update.view)
    }
  },
  { decorations: (value) => value.decorations },
)
