import type { EditorView } from '@codemirror/view'

function selected(view: EditorView) {
  const { from, to } = view.state.selection.main
  return { from, to, text: view.state.doc.sliceString(from, to) }
}

export function insertMarkdownLink(view: EditorView): boolean {
  const { from, to, text } = selected(view)
  const label = text || '链接文字'
  const insert = `[${label}](https://)`
  view.dispatch({
    changes: { from, to, insert },
    selection: { anchor: from + label.length + 3, head: from + insert.length - 1 },
  })
  return true
}

export function insertTaskItem(view: EditorView): boolean {
  const { from } = view.state.selection.main
  const line = view.state.doc.lineAt(from)
  const already = /^\s*- \[[ xX]\]\s/.test(line.text)
  if (already) return true
  const indent = line.text.match(/^\s*/)?.[0] ?? ''
  view.dispatch({
    changes: { from: line.from, to: line.from + indent.length, insert: `${indent}- [ ] ` },
    selection: { anchor: line.from + indent.length + 6 },
  })
  return true
}
