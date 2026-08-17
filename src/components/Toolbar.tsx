import type { ViewMode } from '../types'
import { useWorkspace, workspace } from '../lib/workspace-store'
import { countWords } from '../lib/document-tree'
import { manageLabel } from '../lib/manage-list'
import { IconExport, IconFocus, IconImport, IconSidebar, IconTheme } from './Icons'

type Props = {
  view: ViewMode
  title: string
  content: string
  saveState: 'idle' | 'saving' | 'saved'
  focusMode: boolean
  sidebarOpen: boolean
  theme: 'system' | 'light' | 'dark'
}

function exportMarkdown(title: string, content: string) {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${title || '未命名文稿'}.md`
  link.click()
  URL.revokeObjectURL(url)
}

export function Toolbar({ view, title, content, saveState, focusMode, sidebarOpen, theme }: Props) {
  const state = useWorkspace()
  const stats = countWords(content)
  const themeLabel = theme === 'system' ? '跟随系统' : theme === 'light' ? '浅色' : '深色'
  const saveLabel = saveState === 'saving' ? '正在保存' : saveState === 'saved' ? '已保存' : ''
  const manage = workspace.currentManageItem()
  const status =
    state.chromeMode === 'edit'
      ? `编辑模式 : row${state.caret.line} : col${state.caret.col} : ${stats.chars}字 ${stats.words}词`
      : state.chromeMode === 'select'
        ? `选择模式 ：${title}`
        : `管理模式 ：${manage ? manageLabel(manage, state.folders, state.sheets) : title}`

  return (
    <header className="chrome">
      <div className="chrome-left">
        <button className="ghost-btn" title="侧栏" onClick={() => workspace.toggleSidebar()}>
          <IconSidebar />
        </button>
        <span className={`save-dot ${saveState}`}>{saveLabel}</span>
        {!sidebarOpen ? <strong className="inline-title">{title}</strong> : null}
      </div>

      <nav className="mode-switch" aria-label="视图">
        {(
          [
            ['write', '写作'],
            ['preview', '预览'],
            ['outline', '大纲'],
            ['map', '导图'],
          ] as const
        ).map(([id, label]) => (
          <button key={id} className={view === id ? 'is-active' : ''} onClick={() => workspace.setView(id)}>
            {label}
          </button>
        ))}
      </nav>

      <div className="chrome-right">
        <span className="stats">{status}</span>
        <button className={`ghost-btn ${focusMode ? 'is-on' : ''}`} title="焦点模式" onClick={() => workspace.toggleFocus()}>
          <IconFocus />
        </button>
        <button className="ghost-btn" title={themeLabel} onClick={() => workspace.cycleTheme()}>
          <IconTheme />
        </button>
        <button className="ghost-btn" title="导出当前文稿 Markdown" onClick={() => exportMarkdown(title, content)}>
          <IconExport />
        </button>
        <button className="text-btn" title="导出工作区备份" onClick={() => workspace.exportBackup()}>
          备份
        </button>
        <button className="text-btn" title="结束本次写作（Ctrl+Shift+E）" onClick={() => void workspace.prepareFinishWriting()}>
          结束写作
        </button>
        <label className="text-btn" title="导入工作区备份">
          <IconImport />
          导入
          <input
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) void workspace.importBackup(file)
              event.target.value = ''
            }}
          />
        </label>
      </div>
    </header>
  )
}
