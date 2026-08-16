import { RangeSetBuilder } from '@codemirror/state'
import { Decoration, EditorView, ViewPlugin, WidgetType, type DecorationSet, type ViewUpdate } from '@codemirror/view'
import { displayWiki, openWikiTitle } from './wiki'
import { workspace } from '../lib/workspace-store'

const WIKI_RE = /\[\[([^[\]]+)\]\]/g

class WikiWidget extends WidgetType {
  title: string
  ref: string
  constructor(title: string, ref: string) {
    super()
    this.title = title
    this.ref = ref
  }
  eq(other: WikiWidget) {
    return this.title === other.title && this.ref === other.ref
  }
  toDOM() {
    const el = document.createElement('span')
    el.className = 'wiki-chip'
    el.textContent = this.title
    el.title = `打开「${this.title}」`
    el.addEventListener('mousedown', (event) => {
      event.preventDefault()
      event.stopPropagation()
      openWikiTitle(this.ref)
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
      const label = displayWiki(match[1], workspace.get().sheets)
      builder.add(start, end, Decoration.replace({ widget: new WikiWidget(label, match[1]) }))
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
