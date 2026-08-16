import { useEffect, useMemo, useRef, useState } from 'react'
import { EditorState } from '@codemirror/state'
import { EditorView, keymap, placeholder } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { markdown } from '@codemirror/lang-markdown'
import { languages } from '@codemirror/language-data'
import { syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language'
import { searchKeymap } from '@codemirror/search'
import { folioEditorTheme, folioHighlight } from './theme'
import { superSyntax } from './super-syntax'
import { mathSyntax } from './math-syntax'
import { liveBlocks } from './live-blocks'
import { wikiSyntax } from './wiki-syntax'
import { calloutDecor } from './callouts'
import { detectSlash, type SlashSession } from './slash/commands'
import { SlashMenu } from './slash/SlashMenu'
import { detectWiki, type WikiSession } from './wiki'
import { WikiMenu } from './WikiMenu'
import { workspace } from '../lib/workspace-store'
import { handleEscape } from '../lib/chrome-keys'
import { locateLogical } from '../lib/logical-line'
import { insertMarkdownLink, insertTaskItem } from './markdown-keys'
import { splitFrontmatter } from '../lib/frontmatter'
import { YamlCard } from '../components/YamlCard'

type Props = {
  sheetId: string
  content: string
  onChange: (value: string) => void
  caret: number
  active: boolean
}

function parts(content: string) {
  const doc = splitFrontmatter(content)
  if (!doc.hasFence) return { prefix: '', body: content, attrs: doc.attrs, hasFence: false }
  return {
    prefix: content.slice(0, content.length - doc.body.length),
    body: doc.body,
    attrs: doc.attrs,
    hasFence: true,
  }
}

export function EditorPane({ sheetId, content, onChange, caret, active }: Props) {
  const host = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const onChangeRef = useRef(onChange)
  const parsed = useMemo(() => parts(content), [content])
  const parsedRef = useRef(parsed)
  const boot = useRef({ id: sheetId, body: parsed.body })
  const [session, setSession] = useState<SlashSession | null>(null)
  const [wiki, setWiki] = useState<WikiSession | null>(null)
  const caretRef = useRef(caret)
  const activeRef = useRef(active)
  if (boot.current.id !== sheetId) boot.current = { id: sheetId, body: parsed.body }
  onChangeRef.current = onChange
  parsedRef.current = parsed
  caretRef.current = caret
  activeRef.current = active

  useEffect(() => {
    if (!host.current) return

    const view = new EditorView({
      parent: host.current,
      state: EditorState.create({
        doc: boot.current.body,
        extensions: [
          history(),
          markdown({ codeLanguages: languages }),
          folioEditorTheme,
          folioHighlight,
          syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
          placeholder('输入 / 唤起超级斜杠…'),
          keymap.of([
            {
              key: 'Escape',
              run: () => {
                handleEscape(new KeyboardEvent('keydown', { key: 'Escape' }))
                return true
              },
              preventDefault: true,
            },
            { key: 'Mod-k', run: insertMarkdownLink, preventDefault: true },
            { key: 'Mod-l', run: insertTaskItem, preventDefault: true },
            {
              key: 'Mod-y',
              run: () => {
                workspace.openYamlEditor()
                return true
              },
              preventDefault: true,
            },
            ...defaultKeymap,
            ...historyKeymap,
            ...searchKeymap,
            indentWithTab,
          ]),
          EditorView.lineWrapping,
          superSyntax,
          mathSyntax,
          liveBlocks,
          wikiSyntax,
          calloutDecor,
          EditorView.updateListener.of((update) => {
            if (update.docChanged) onChangeRef.current(parsedRef.current.prefix + update.state.doc.toString())
            if (update.docChanged || update.selectionSet) {
              const pos = update.state.selection.main.head
              const full = parsedRef.current.prefix + update.state.doc.toString()
              const logical = locateLogical(full, parsedRef.current.prefix.length + pos)
              workspace.setCaret(sheetId, parsedRef.current.prefix.length + pos, logical.row, logical.col)
              const nextSlash = detectSlash(update.view)
              const nextWiki = detectWiki(update.view)
              queueMicrotask(() => {
                setWiki(nextWiki)
                setSession((prev) => {
                  if (nextWiki || !nextSlash) return null
                  const same = prev?.from === nextSlash.from
                  const codePath = nextSlash.path[0] && /^(code|代码|fence)$/i.test(nextSlash.path[0])
                  const mode =
                    same && prev?.mode === 'table'
                      ? 'table'
                      : codePath || (same && prev?.mode === 'code')
                        ? 'code'
                        : 'list'
                  return { ...nextSlash, mode }
                })
              })
            }
          }),
        ],
      }),
    })

    viewRef.current = view
    const bodyCaret = Math.max(0, caretRef.current - parsedRef.current.prefix.length)
    const start = Math.min(bodyCaret, view.state.doc.length)
    view.dispatch({ selection: { anchor: start } })
    if (activeRef.current) view.focus()
    else view.contentDOM.blur()

    return () => {
      view.destroy()
      viewRef.current = null
    }
  }, [sheetId])

  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    if (view.state.doc.toString() === parsed.body) return
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: parsed.body },
    })
  }, [parsed.body])

  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    if (active) {
      const bodyCaret = Math.max(0, caretRef.current - parsedRef.current.prefix.length)
      const pos = Math.min(bodyCaret, view.state.doc.length)
      view.dispatch({ selection: { anchor: pos }, scrollIntoView: true })
      view.focus()
    } else {
      view.contentDOM.blur()
    }
  }, [active, sheetId])

  return (
    <div className="editor-host">
      {parsed.hasFence ? (
        <YamlCard
          attrs={parsed.attrs}
          onEdit={() => workspace.openYamlEditor()}
          onWikiClick={(ref) => workspace.openWiki(ref)}
        />
      ) : null}
      <div className="editor-mount" ref={host} />
      {wiki && viewRef.current ? (
        <WikiMenu view={viewRef.current} session={wiki} currentId={sheetId} onClose={() => setWiki(null)} />
      ) : null}
      {!wiki && session && viewRef.current ? (
        <SlashMenu
          view={viewRef.current}
          session={session}
          onClose={() => setSession(null)}
          onMode={(mode) => setSession((prev) => (prev ? { ...prev, mode } : prev))}
        />
      ) : null}
    </div>
  )
}
