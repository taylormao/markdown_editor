import { useEffect, useRef } from 'react'
import type { Folder } from '../types'

export type ContextTarget =
  | { kind: 'sheet'; id: string }
  | { kind: 'folder'; id: string }

type Props = {
  target: ContextTarget
  x: number
  y: number
  folders: Folder[]
  currentFolderId?: string
  onRename: () => void
  onDelete: () => void
  onMove?: (folderId: string) => void
  onNewSheet?: () => void
  onNewFolder?: () => void
  onClose: () => void
}

export function ContextMenu({
  target,
  x,
  y,
  folders,
  currentFolderId,
  onRename,
  onDelete,
  onMove,
  onNewSheet,
  onNewFolder,
  onClose,
}: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onDown = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) onClose()
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  const destinations = folders.filter((folder) => folder.id !== currentFolderId)
  const left = Math.min(x, window.innerWidth - 200)
  const top = Math.min(y, window.innerHeight - 240)

  return (
    <div className="ctx-menu" ref={ref} style={{ left, top }} role="menu">
      {target.kind === 'folder' ? (
        <>
          {onNewSheet ? <button onClick={onNewSheet}>新建文稿</button> : null}
          {onNewFolder ? <button onClick={onNewFolder}>新建子文件夹</button> : null}
        </>
      ) : null}
      <button onClick={onRename}>重命名</button>
      {target.kind === 'sheet' && onMove ? (
        <div className="ctx-sub">
          <button className="ctx-parent">移动到</button>
          <div className="ctx-flyout">
            {destinations.length === 0 ? (
              <div className="ctx-empty">没有其他文件夹</div>
            ) : (
              destinations.map((folder) => (
                <button key={folder.id} onClick={() => onMove(folder.id)}>
                  {folder.name}
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}
      <button className="is-danger" onClick={onDelete}>
        删除
      </button>
    </div>
  )
}
