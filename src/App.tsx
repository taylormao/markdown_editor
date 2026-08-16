import { lazy, Suspense, useEffect } from 'react'
import { useWorkspace, workspace } from './lib/workspace-store'
import { handleEscape } from './lib/chrome-keys'
import { Sidebar } from './components/Sidebar'
import { TabBar } from './components/TabBar'
import { Toolbar } from './components/Toolbar'
import { TemplatePicker } from './components/TemplatePicker'
import { YamlIssues } from './components/YamlIssues'
import { YamlEditor } from './components/YamlEditor'

const EditorPane = lazy(() => import('./editor/EditorPane').then((m) => ({ default: m.EditorPane })))
const MarkdownPreview = lazy(() => import('./lib/render-markdown').then((m) => ({ default: m.MarkdownPreview })))
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
    void workspace.hydrate()
  }, [])

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
      const typing = event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement
      if (handleEscape(event)) return
      const mode = workspace.get().chromeMode
      if (mode === 'select' && !typing) {
        if (event.key === 'Tab') {
          event.preventDefault()
          workspace.nextTab()
          return
        }
        if (event.key === 'Enter') {
          event.preventDefault()
          workspace.setChromeMode('edit', '进入编辑模式')
          return
        }
        if (event.key === 'F2') {
          event.preventDefault()
          workspace.requestRename({ kind: 'sheet', id: workspace.get().activeSheetId })
          return
        }
      }
      if (mode === 'manage' && !typing) {
        if (event.key === 'ArrowDown') {
          event.preventDefault()
          workspace.moveManage(1)
          return
        }
        if (event.key === 'ArrowUp') {
          event.preventDefault()
          workspace.moveManage(-1)
          return
        }
        if (event.key === 'ArrowRight') {
          event.preventDefault()
          workspace.expandManage()
          return
        }
        if (event.key === 'ArrowLeft') {
          event.preventDefault()
          workspace.collapseManage()
          return
        }
        if (event.key === 'Enter') {
          event.preventDefault()
          workspace.confirmManage()
          return
        }
        if (event.key === 'F2') {
          event.preventDefault()
          const item = workspace.currentManageItem()
          if (item?.kind === 'folder' || item?.kind === 'sheet') workspace.requestRename({ kind: item.kind, id: item.id })
          return
        }
      }
      const meta = event.metaKey || event.ctrlKey
      if (meta && event.key === '\\') {
        event.preventDefault()
        workspace.toggleSidebar()
      }
      if (meta && event.key === '.') {
        event.preventDefault()
        workspace.toggleFocus()
      }
      if (meta && event.key.toLowerCase() === 'y' && workspace.get().chromeMode === 'edit') {
        event.preventDefault()
        workspace.openYamlEditor()
        return
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
        workspace.setView('preview')
      }
      if (meta && event.key === '3') {
        event.preventDefault()
        workspace.setView('outline')
      }
      if (meta && event.key === '4') {
        event.preventDefault()
        workspace.setView('map')
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [])

  if (!state.hydrated) {
    return <div className="app-shell is-empty">正在铺纸…</div>
  }

  if (!sheet) {
    return (
      <div className="app-shell is-empty">
        <button className="primary-btn" onClick={() => workspace.requestNewSheet()}>
          写下第一篇
        </button>
      </div>
    )
  }

  return (
    <div className={`app-shell mode-${state.chromeMode} ${state.focusMode ? 'is-focus' : ''} ${state.sidebarOpen ? '' : 'is-collapsed'}`}>
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
          <div className="stage-top">
            <Toolbar
              view={state.view}
              title={sheet.title}
              content={sheet.content}
              saveState={state.saveState}
              focusMode={state.focusMode}
              sidebarOpen={state.sidebarOpen}
              theme={state.theme}
            />
            <TabBar sheets={state.sheets} openTabIds={state.openTabIds} activeSheetId={sheet.id} />
            <YamlIssues />
          </div>
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
                caret={state.caretBySheet[sheet.id] ?? 0}
                active={state.chromeMode === 'edit'}
                onChange={(value) => workspace.updateSheetContent(sheet.id, value)}
              />
            ) : null}
            {state.view === 'preview' ? (
              <MarkdownPreview content={sheet.content} onWikiClick={(title) => workspace.openSheetByTitle(title)} />
            ) : null}
            {state.view === 'outline' ? <OutlineView content={sheet.content} /> : null}
            {state.view === 'map' ? <MindMapView content={sheet.content} /> : null}
          </Suspense>
        </section>
      </main>
      {state.toast ? <div className="mode-toast">{state.toast}</div> : null}
      {state.templatePickerFor ? <TemplatePicker /> : null}
      {state.yamlEditorOpen ? <YamlEditor /> : null}
    </div>
  )
}
