import { useEffect, useMemo, useRef, useState } from 'react'
import type { EditorView } from '@codemirror/view'
import { filterCommands, insertTable, type SlashCommand, type SlashSession } from './commands'

type Props = {
  view: EditorView
  session: SlashSession
  onClose: () => void
  onMode: (mode: SlashSession['mode']) => void
}

const GROUPS: Record<SlashCommand['group'], string> = {
  block: '块',
  mark: '样式',
  heading: '标题',
}

export function SlashMenu({ view, session, onClose, onMode }: Props) {
  const items = useMemo(() => filterCommands(session.query), [session.query])
  const [index, setIndex] = useState(0)
  const [hover, setHover] = useState({ rows: 3, cols: 3 })
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setIndex(0)
  }, [session.query, session.mode])

  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>('[data-active="true"]')
    el?.scrollIntoView({ block: 'nearest' })
  }, [index])

  const run = (cmd: SlashCommand) => {
    if (cmd.id === 'table') {
      onMode('table')
      return
    }
    cmd.insert(view, session.from, session.to)
    onClose()
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (session.mode === 'table') {
        if (event.key === 'Escape') {
          event.preventDefault()
          event.stopPropagation()
          onMode('list')
        }
        if (event.key === 'Enter') {
          event.preventDefault()
          event.stopPropagation()
          insertTable(view, session.from, session.to, hover.rows, hover.cols)
          onClose()
        }
        if (event.key === 'ArrowRight') {
          event.preventDefault()
          setHover((prev) => ({ ...prev, cols: Math.min(12, prev.cols + 1) }))
        }
        if (event.key === 'ArrowLeft') {
          event.preventDefault()
          setHover((prev) => ({ ...prev, cols: Math.max(1, prev.cols - 1) }))
        }
        if (event.key === 'ArrowDown') {
          event.preventDefault()
          setHover((prev) => ({ ...prev, rows: Math.min(12, prev.rows + 1) }))
        }
        if (event.key === 'ArrowUp') {
          event.preventDefault()
          setHover((prev) => ({ ...prev, rows: Math.max(2, prev.rows - 1) }))
        }
        return
      }

      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        onClose()
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
        event.preventDefault()
        event.stopPropagation()
        const cmd = items[index]
        if (!cmd) return
        if (cmd.id === 'table') onMode('table')
        else {
          cmd.insert(view, session.from, session.to)
          onClose()
        }
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [items, index, session, hover, view, onClose, onMode])

  const grouped = items.reduce<Record<string, SlashCommand[]>>((acc, item) => {
    acc[item.group] ??= []
    acc[item.group].push(item)
    return acc
  }, {})

  return (
    <div className="slash-menu" style={{ left: session.left, top: session.top }} role="listbox">
      {session.mode === 'table' ? (
        <div className="slash-table">
          <div className="slash-head">表格 · {hover.rows} × {hover.cols}</div>
          <div className="slash-grid">
            {Array.from({ length: 8 }, (_, row) =>
              Array.from({ length: 8 }, (_, col) => {
                const rows = row + 1
                const cols = col + 1
                const on = rows <= hover.rows && cols <= hover.cols
                return (
                  <button
                    key={`${rows}-${cols}`}
                    className={on ? 'is-on' : ''}
                    onMouseEnter={() => setHover({ rows: Math.max(2, rows), cols })}
                    onClick={() => {
                      insertTable(view, session.from, session.to, Math.max(2, rows), cols)
                      onClose()
                    }}
                  />
                )
              }),
            )}
          </div>
          <p className="slash-tip">方向键调整，回车插入</p>
        </div>
      ) : items.length === 0 ? (
        <div className="slash-empty">没有匹配的命令</div>
      ) : (
        <div className="slash-list" ref={listRef}>
          {(Object.keys(grouped) as SlashCommand['group'][]).map((group) => (
            <section key={group}>
              <div className="slash-head">{GROUPS[group]}</div>
              {grouped[group].map((item) => {
                const active = items[index]?.id === item.id
                return (
                  <button
                    key={item.id}
                    data-active={active}
                    className={active ? 'is-active' : ''}
                    onMouseEnter={() => setIndex(items.findIndex((entry) => entry.id === item.id))}
                    onMouseDown={(event) => {
                      event.preventDefault()
                      run(item)
                    }}
                  >
                    <span>{item.title}</span>
                    <code>{item.hint}</code>
                  </button>
                )
              })}
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
