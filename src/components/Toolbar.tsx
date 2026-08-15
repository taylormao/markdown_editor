import type { ViewMode } from '../types'
import { workspace } from '../lib/workspace-store'
import { countWords } from '../lib/document-tree'
import { IconExport, IconFocus, IconSidebar, IconTheme } from './Icons'

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
  const stats = countWords(content)
  const themeLabel = theme === 'system' ? '跟随系统' : theme === 'light' ? '浅色' : '深色'
  const saveLabel = saveState === 'saving' ? '正在保存' : saveState === 'saved' ? '已保存' : ''

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
        <span className="stats">
          {stats.chars} 字 · {stats.words} 词
        </span>
        <button className={`ghost-btn ${focusMode ? 'is-on' : ''}`} title="焦点模式" onClick={() => workspace.toggleFocus()}>
          <IconFocus />
        </button>
        <button className="ghost-btn" title={themeLabel} onClick={() => workspace.cycleTheme()}>
          <IconTheme />
        </button>
        <button className="ghost-btn" title="导出 Markdown" onClick={() => exportMarkdown(title, content)}>
          <IconExport />
        </button>
      </div>
    </header>
  )
}
