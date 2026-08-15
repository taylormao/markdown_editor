import { RangeSetBuilder } from '@codemirror/state'
import { Decoration, EditorView, ViewPlugin, WidgetType, type DecorationSet, type ViewUpdate } from '@codemirror/view'
import { openWikiTitle } from './wiki'

const WIKI_RE = /\[\[([^[\]]+)\]\]/g

class WikiWidget extends WidgetType {
  title: string
  constructor(title: string) {
    super()
    this.title = title
  }
  eq(other: WikiWidget) {
    return this.title === other.title
  }
  toDOM() {
    const el = document.createElement('span')
    el.className = 'wiki-chip'
    el.textContent = this.title
    el.title = `打开「${this.title}」`
    el.addEventListener('mousedown', (event) => {
      event.preventDefault()
      event.stopPropagation()
      openWikiTitle(this.title)
    })
    return el
  }
  ignoreEvent() {
    return false
  }
}

function selectionInside(view: EditorView, from: number, to: number): boolean {
  return view.state.selection.ranges.some((range) => range.from > from && range.to < to)
}

function buildDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>()
  for (const { from, to } of view.visibleRanges) {
    const text = view.state.doc.sliceString(from, to)
    WIKI_RE.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = WIKI_RE.exec(text))) {
      const start = from + match.index
      const end = start + match[0].length
      if (selectionInside(view, start, end)) continue
      builder.add(start, end, Decoration.replace({ widget: new WikiWidget(match[1]) }))
    }
  }
  return builder.finish()
}

export const wikiSyntax = ViewPlugin.fromClass(
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
