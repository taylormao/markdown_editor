import { useEffect, useMemo, useRef, useState } from 'react'
import type { EditorView } from '@codemirror/view'
import { useWorkspace } from '../lib/workspace-store'
import { insertWikiLink, searchSheets, type WikiSession } from './wiki'

type Props = {
  view: EditorView
  session: WikiSession
  currentId: string
  onClose: () => void
}

export function WikiMenu({ view, session, currentId, onClose }: Props) {
  const { sheets } = useWorkspace()
  const items = useMemo(() => searchSheets(session.query, sheets, currentId), [session.query, sheets, currentId])
  const [index, setIndex] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setIndex(0)
  }, [session.query])

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>('[data-active="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [index])

  const pick = (title: string) => {
    insertWikiLink(view, session.from, session.to, title)
    onClose()
  }
  const pickRef = useRef(pick)
  pickRef.current = pick

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        onClose()
        return
      }
      if (!items.length) return
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        event.stopPropagation()
        setIndex((prev) => (prev + 1) % items.length)
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault()
        event.stopPropagation()
        setIndex((prev) => (prev - 1 + items.length) % items.length)
      }
      if (event.key === 'Enter' || event.key === 'Tab') {
        const item = items[index]
        if (!item) return
        event.preventDefault()
        event.stopPropagation()
        pickRef.current(item.title)
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [items, index, session, view, onClose])

  return (
    <div className="slash-menu" style={{ left: session.left, top: session.top }} role="listbox">
      <div className="slash-head">双链 · {session.query || '文稿名'}</div>
      {items.length === 0 ? (
        <div className="slash-empty">没有匹配的文稿</div>
      ) : (
        <div className="slash-list" ref={listRef}>
          {items.map((item, itemIndex) => (
            <button
              key={item.id}
              data-active={index === itemIndex}
              className={index === itemIndex ? 'is-active' : ''}
              onMouseEnter={() => setIndex(itemIndex)}
              onMouseDown={(event) => {
                event.preventDefault()
        pickRef.current(item.title)
              }}
            >
              <span>{item.title}</span>
              <code>[[ ]]</code>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
