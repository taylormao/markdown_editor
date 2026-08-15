import { lazy, Suspense, useEffect } from 'react'
import { useWorkspace, workspace } from './lib/workspace-store'
import { Sidebar } from './components/Sidebar'
import { Toolbar } from './components/Toolbar'

const EditorPane = lazy(() => import('./editor/EditorPane').then((m) => ({ default: m.EditorPane })))
const OutlineView = lazy(() => import('./components/OutlineView').then((m) => ({ default: m.OutlineView })))
const MindMapView = lazy(() => import('./components/MindMapView').then((m) => ({ default: m.MindMapView })))

function resolveTheme(theme: 'system' | 'light' | 'dark'): 'light' | 'dark' {
  if (theme !== 'system') return theme
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export default function App() {
  const state = useWorkspace()
  const sheet = state.sheets.find((item) => item.id === state.activeSheetId) ?? state.sheets[0]

  useEffect(() => {
    const apply = () => {
      document.documentElement.dataset.theme = resolveTheme(state.theme)
    }
    apply()
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [state.theme])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const meta = event.metaKey || event.ctrlKey
      if (meta && event.key === '\\') {
        event.preventDefault()
        workspace.toggleSidebar()
      }
      if (meta && event.key === '.') {
        event.preventDefault()
        workspace.toggleFocus()
      }
      if (meta && event.key.toLowerCase() === 'n') {
        event.preventDefault()
        workspace.createSheet()
      }
      if (meta && event.key === '1') {
        event.preventDefault()
        workspace.setView('write')
      }
      if (meta && event.key === '2') {
        event.preventDefault()
        workspace.setView('outline')
      }
      if (meta && event.key === '3') {
        event.preventDefault()
        workspace.setView('map')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (!sheet) {
    return (
      <div className="app-shell is-empty">
        <button className="primary-btn" onClick={() => workspace.createSheet()}>
          写下第一篇
        </button>
      </div>
    )
  }

  return (
    <div className={`app-shell ${state.focusMode ? 'is-focus' : ''} ${state.sidebarOpen ? '' : 'is-collapsed'}`}>
      {state.sidebarOpen && !state.focusMode ? (
        <Sidebar
          folders={state.folders}
          sheets={state.sheets}
          activeFolderId={state.activeFolderId}
          activeSheetId={sheet.id}
          query={state.query}
        />
      ) : null}

      <main className="stage">
        {!state.focusMode ? (
          <Toolbar
            view={state.view}
            title={sheet.title}
            content={sheet.content}
            saveState={state.saveState}
            focusMode={state.focusMode}
            sidebarOpen={state.sidebarOpen}
            theme={state.theme}
          />
        ) : (
          <button className="focus-exit" onClick={() => workspace.toggleFocus()}>
            退出焦点
          </button>
        )}

        <section className="canvas">
          <Suspense fallback={<div className="empty-stage">正在铺纸…</div>}>
            {state.view === 'write' ? (
              <EditorPane
                sheetId={sheet.id}
                content={sheet.content}
                onChange={(value) => workspace.updateSheetContent(sheet.id, value)}
              />
            ) : null}
            {state.view === 'outline' ? <OutlineView content={sheet.content} /> : null}
            {state.view === 'map' ? <MindMapView content={sheet.content} /> : null}
          </Suspense>
        </section>
      </main>
    </div>
  )
}
