import { useEffect, useRef, useState } from 'react'
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

type Props = {
  sheetId: string
  content: string
  onChange: (value: string) => void
}

export function EditorPane({ sheetId, content, onChange }: Props) {
  const host = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const onChangeRef = useRef(onChange)
  const boot = useRef({ id: sheetId, content })
  const [session, setSession] = useState<SlashSession | null>(null)
  const [wiki, setWiki] = useState<WikiSession | null>(null)
  if (boot.current.id !== sheetId) boot.current = { id: sheetId, content }
  onChangeRef.current = onChange

  useEffect(() => {
    if (!host.current) return

    const view = new EditorView({
      parent: host.current,
      state: EditorState.create({
        doc: boot.current.content,
        extensions: [
          history(),
          markdown({ codeLanguages: languages }),
          folioEditorTheme,
          folioHighlight,
          syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
          placeholder('输入 / 唤起超级斜杠…'),
          keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap, indentWithTab]),
          EditorView.lineWrapping,
          superSyntax,
          mathSyntax,
          liveBlocks,
          wikiSyntax,
          calloutDecor,
          EditorView.updateListener.of((update) => {
            if (update.docChanged) onChangeRef.current(update.state.doc.toString())
            if (update.docChanged || update.selectionSet) {
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
    view.focus()

    return () => {
      view.destroy()
      viewRef.current = null
    }
  }, [sheetId])

  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    if (view.state.doc.toString() === content) return
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: content },
    })
  }, [content])

  return (
    <div className="editor-host">
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
