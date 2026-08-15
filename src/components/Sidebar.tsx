import { useState } from 'react'
import type { Folder, Sheet } from '../types'
import { workspace } from '../lib/workspace-store'
import { excerptFromContent } from '../lib/document-tree'
import { IconFolder, IconInbox, IconPlus, IconSearch, IconStar, IconTrash } from './Icons'
import { ContextMenu, type ContextTarget } from './ContextMenu'

type Props = {
  folders: Folder[]
  sheets: Sheet[]
  activeFolderId: string
  activeSheetId: string
  query: string
}

function formatTime(ts: number): string {
  const delta = Date.now() - ts
  if (delta < 60_000) return '刚刚'
  if (delta < 3_600_000) return `${Math.floor(delta / 60_000)} 分钟前`
  if (delta < 86_400_000) return `${Math.floor(delta / 3_600_000)} 小时前`
  return new Date(ts).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })
}

export function Sidebar({ folders, sheets, activeFolderId, activeSheetId, query }: Props) {
  const [renaming, setRenaming] = useState<ContextTarget | null>(null)
  const [menu, setMenu] = useState<{ target: ContextTarget; x: number; y: number } | null>(null)
  const q = query.trim().toLowerCase()

  const visible = sheets
    .filter((sheet) => sheet.folderId === activeFolderId)
    .filter((sheet) => {
      if (!q) return true
      return sheet.title.toLowerCase().includes(q) || sheet.content.toLowerCase().includes(q)
    })
    .sort((a, b) => Number(b.starred) - Number(a.starred) || b.updatedAt - a.updatedAt)

  const openMenu = (event: React.MouseEvent, target: ContextTarget) => {
    event.preventDefault()
    event.stopPropagation()
    setMenu({ target, x: event.clientX, y: event.clientY })
  }

  const startRename = (target: ContextTarget) => {
    setRenaming(target)
    setMenu(null)
  }

  return (
    <aside className="glass-rail" onContextMenu={(event) => event.preventDefault()}>
      <div className="rail-head">
        <div className="brand">
          <span className="brand-mark" />
          <span>Folio</span>
        </div>
        <button className="ghost-btn" title="新建文稿" onClick={() => workspace.createSheet()}>
          <IconPlus />
        </button>
      </div>

      <label className="search">
        <IconSearch />
        <input
          value={query}
          placeholder="搜索文稿"
          onChange={(event) => workspace.setQuery(event.target.value)}
        />
      </label>

      <div className="folder-list">
        {folders.map((folder) => {
          const count = sheets.filter((sheet) => sheet.folderId === folder.id).length
          const Icon = folder.order === 0 ? IconInbox : IconFolder
          const editing = renaming?.kind === 'folder' && renaming.id === folder.id
          return (
            <button
              key={folder.id}
              className={`folder-item ${folder.id === activeFolderId ? 'is-active' : ''}`}
              onClick={() => workspace.selectFolder(folder.id)}
              onDoubleClick={() => startRename({ kind: 'folder', id: folder.id })}
              onContextMenu={(event) => openMenu(event, { kind: 'folder', id: folder.id })}
            >
              <Icon />
              {editing ? (
                <input
                  autoFocus
                  className="inline-input"
                  defaultValue={folder.name}
                  onBlur={(event) => {
                    workspace.renameFolder(folder.id, event.target.value.trim() || folder.name)
                    setRenaming(null)
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') (event.target as HTMLInputElement).blur()
                    if (event.key === 'Escape') setRenaming(null)
                  }}
                  onClick={(event) => event.stopPropagation()}
                />
              ) : (
                <span className="folder-name">{folder.name}</span>
              )}
              <em>{count}</em>
            </button>
          )
        })}
        <button className="folder-item is-muted" onClick={() => workspace.createFolder()}>
          <IconPlus size={14} />
          <span>新文件夹</span>
        </button>
      </div>

      <div className="card-scroll">
        {visible.length === 0 ? (
          <div className="empty-hint">这一格还是空的</div>
        ) : (
          visible.map((sheet) => {
            const editing = renaming?.kind === 'sheet' && renaming.id === sheet.id
            return (
              <article
                key={sheet.id}
                className={`sheet-card ${sheet.id === activeSheetId ? 'is-active' : ''}`}
                onClick={() => workspace.selectSheet(sheet.id)}
                onDoubleClick={() => startRename({ kind: 'sheet', id: sheet.id })}
                onContextMenu={(event) => openMenu(event, { kind: 'sheet', id: sheet.id })}
              >
                <header>
                  {editing ? (
                    <input
                      autoFocus
                      className="inline-input"
                      defaultValue={sheet.title}
                      onClick={(event) => event.stopPropagation()}
                      onBlur={(event) => {
                        workspace.renameSheet(sheet.id, event.target.value)
                        setRenaming(null)
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') (event.target as HTMLInputElement).blur()
                        if (event.key === 'Escape') setRenaming(null)
                      }}
                    />
                  ) : (
                    <h3>{sheet.title}</h3>
                  )}
                  <div className="card-actions">
                    <button
                      className={sheet.starred ? 'is-on' : ''}
                      title="星标"
                      onClick={(event) => {
                        event.stopPropagation()
                        workspace.toggleStar(sheet.id)
                      }}
                    >
                      <IconStar filled={sheet.starred} />
                    </button>
                    <button
                      title="删除"
                      onClick={(event) => {
                        event.stopPropagation()
                        if (confirm('删除这篇文稿？')) workspace.deleteSheet(sheet.id)
                      }}
                    >
                      <IconTrash />
                    </button>
                  </div>
                </header>
                <p>{excerptFromContent(sheet.content)}</p>
                <time>{formatTime(sheet.updatedAt)}</time>
              </article>
            )
          })
        )}
      </div>

      {menu ? (
        <ContextMenu
          target={menu.target}
          x={menu.x}
          y={menu.y}
          folders={folders}
          currentFolderId={menu.target.kind === 'sheet' ? sheets.find((sheet) => sheet.id === menu.target.id)?.folderId : undefined}
          onRename={() => startRename(menu.target)}
          onDelete={() => {
            if (menu.target.kind === 'sheet') {
              if (confirm('删除这篇文稿？')) workspace.deleteSheet(menu.target.id)
            } else if (folders.length > 1 && confirm('删除这个文件夹？其中的文稿会移到第一个文件夹。')) {
              workspace.deleteFolder(menu.target.id)
            }
            setMenu(null)
          }}
          onMove={
            menu.target.kind === 'sheet'
              ? (folderId) => {
                  workspace.moveSheet(menu.target.id, folderId)
                  setMenu(null)
                }
              : undefined
          }
          onClose={() => setMenu(null)}
        />
      ) : null}
    </aside>
  )
}
