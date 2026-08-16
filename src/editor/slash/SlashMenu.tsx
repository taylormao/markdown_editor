import { useEffect, useMemo, useRef, useState } from 'react'
import type { EditorView } from '@codemirror/view'
import { filterCommands, insertCodeFence, insertTable, type SlashCommand, type SlashSession } from './commands'
import { filterLanguages, type CodeLanguage } from './languages'

type Props = {
  view: EditorView
  session: SlashSession
  onClose: () => void
  onMode: (mode: SlashSession['mode']) => void
}

const GROUPS: Record<SlashCommand['group'], string> = {
  block: '块',
  mark: '样式',
}

function isCodePath(path: string[]) {
  const head = path[0]?.toLowerCase() ?? ''
  return head === 'code' || head === '代码' || head === 'fence'
}

export function SlashMenu({ view, session, onClose, onMode }: Props) {
  const codeMode = session.mode === 'code' || isCodePath(session.path)
  const items = useMemo(() => filterCommands(codeMode ? '' : session.query), [codeMode, session.query])
  const langs = useMemo(
    () => filterLanguages(isCodePath(session.path) ? session.query : ''),
    [session.path, session.query],
  )
  const visualItems = useMemo(
    () => (Object.keys(GROUPS) as SlashCommand['group'][]).flatMap((group) => items.filter((item) => item.group === group)),
    [items],
  )
  const [index, setIndex] = useState(0)
  const [hover, setHover] = useState({ rows: 3, cols: 3 })
  const listRef = useRef<HTMLDivElement>(null)
  const list = codeMode ? langs : visualItems
  const pathKey = session.path.join('/')

  useEffect(() => {
    setIndex(0)
  }, [session.query, session.mode, pathKey])

  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>('[data-active="true"]')
    el?.scrollIntoView({ block: 'nearest' })
  }, [index])

  const run = (cmd: SlashCommand) => {
    if (cmd.id === 'table') {
      onMode('table')
      return
    }
    if (cmd.id === 'code') {
      if (!isCodePath(session.path)) {
        view.dispatch({
          changes: { from: session.to, insert: '/' },
          selection: { anchor: session.to + 1 },
        })
      }
      onMode('code')
      return
    }
    cmd.insert(view, session.from, session.to)
    onClose()
  }

  const runLang = (lang: CodeLanguage) => {
    insertCodeFence(view, session.from, session.to, lang.fence)
    onClose()
  }
  const runRef = useRef(run)
  const runLangRef = useRef(runLang)
  runRef.current = run
  runLangRef.current = runLang

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
        if (codeMode) onMode('list')
        else onClose()
        return
      }
      if (!list.length) return
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        event.stopPropagation()
        setIndex((prev) => (prev + 1) % list.length)
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault()
        event.stopPropagation()
        setIndex((prev) => (prev - 1 + list.length) % list.length)
      }
      if (event.key === 'Enter' || event.key === 'Tab' || event.key === '/') {
        const current = list[index]
        if (!current) return
        if (!codeMode && event.key === '/' && (current as SlashCommand).id !== 'code') return
        event.preventDefault()
        event.stopPropagation()
        if (codeMode) runLangRef.current(current as CodeLanguage)
        else runRef.current(current as SlashCommand)
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [list, index, session, hover, view, onClose, onMode, codeMode])

  const grouped = visualItems.reduce<Record<string, SlashCommand[]>>((acc, item) => {
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
      ) : codeMode ? (
        langs.length === 0 ? (
          <div className="slash-empty">没有匹配的语言</div>
        ) : (
          <div className="slash-list" ref={listRef}>
            <div className="slash-head">/code/{session.query || '语言'} · 再输入可筛选</div>
            {langs.map((lang, langIndex) => (
              <button
                key={lang.id}
                data-active={index === langIndex}
                className={index === langIndex ? 'is-active' : ''}
                onMouseEnter={() => setIndex(langIndex)}
                onMouseDown={(event) => {
                  event.preventDefault()
                  runLang(lang)
                }}
              >
                <span>{lang.title}</span>
                <code>{lang.fence ? `\`\`\`${lang.fence}` : '```'}</code>
              </button>
            ))}
          </div>
        )
      ) : items.length === 0 ? (
        <div className="slash-empty">没有匹配的命令</div>
      ) : (
        <div className="slash-list" ref={listRef}>
          <div className="slash-head">/{session.query || '命令'} · 输入筛选，/ 进入下级</div>
          {(Object.keys(grouped) as SlashCommand['group'][]).map((group) => (
            <section key={group}>
              <div className="slash-head">{GROUPS[group]}</div>
              {grouped[group].map((item) => {
                const active = visualItems[index]?.id === item.id
                return (
                  <button
                    key={item.id}
                    data-active={active}
                    className={active ? 'is-active' : ''}
                    onMouseEnter={() => setIndex(visualItems.findIndex((entry) => entry.id === item.id))}
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
