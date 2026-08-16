import type { EditorView } from '@codemirror/view'
import type { Sheet } from '../types'
import { workspace } from '../lib/workspace-store'

export type WikiSession = {
  from: number
  to: number
  query: string
  left: number
  top: number
}

export function searchSheets(query: string, sheets: Sheet[], excludeId?: string): Sheet[] {
  const q = query.trim().toLowerCase()
  return sheets
    .filter((sheet) => sheet.id !== excludeId)
    .filter((sheet) => !q || sheet.title.toLowerCase().includes(q))
    .sort((a, b) => {
      const aq = a.title.toLowerCase()
      const bq = b.title.toLowerCase()
      const aStart = q && aq.startsWith(q) ? 0 : 1
      const bStart = q && bq.startsWith(q) ? 0 : 1
      return aStart - bStart || b.updatedAt - a.updatedAt
    })
    .slice(0, 12)
}

export function insertWikiLink(view: EditorView, from: number, to: number, title: string, id?: string) {
  const text = `[[${id || title}]]`
  view.dispatch({
    changes: { from, to, insert: text },
    selection: { anchor: from + text.length },
    userEvent: 'input.wiki',
  })
  view.focus()
}

export function detectWiki(view: EditorView): WikiSession | null {
  const { state } = view
  const main = state.selection.main
  if (!main.empty) return null
  const pos = main.head
  const line = state.doc.lineAt(pos)
  const before = line.text.slice(0, pos - line.from)
  const match = /\[\[([^\]]*)$/.exec(before)
  if (!match) return null

  const from = line.from + match.index
  const query = match[1]
  const coords = view.coordsAtPos(from)
  if (!coords) return null
  const host = (view.dom.closest('.editor-host') ?? view.dom).getBoundingClientRect()
  return {
    from,
    to: pos,
    query,
    left: Math.min(Math.max(8, coords.left - host.left), host.width - 300),
    top: coords.bottom - host.top + 8,
  }
}

export function openWikiTitle(title: string) {
  workspace.openWiki(title)
}

export function displayWiki(ref: string, sheets: { id: string; title: string; content: string }[]): string {
  const hit = sheets.find((sheet) => sheet.id === ref || sheet.content.includes(`id: ${ref}`))
  return hit?.title ?? ref
}
