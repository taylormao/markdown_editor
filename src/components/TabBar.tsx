import { workspace, useWorkspace } from '../lib/workspace-store'
import type { Sheet } from '../types'

type Props = {
  sheets: Sheet[]
  openTabIds: string[]
  activeSheetId: string
}

export function TabBar({ sheets, openTabIds, activeSheetId }: Props) {
  const { chromeMode, renameTarget } = useWorkspace()
  const tabs = openTabIds
    .map((id) => sheets.find((sheet) => sheet.id === id))
    .filter((sheet): sheet is Sheet => Boolean(sheet))

  if (tabs.length === 0) return null

  return (
    <div className={`tab-bar ${chromeMode === 'select' ? 'is-select' : ''}`}>
      {tabs.map((sheet) => {
        const renaming = renameTarget?.kind === 'sheet' && renameTarget.id === sheet.id && chromeMode === 'select'
        return (
          <button
            key={sheet.id}
            className={`tab-item ${sheet.id === activeSheetId ? 'is-active' : ''} ${chromeMode === 'select' && sheet.id === activeSheetId ? 'is-kbd' : ''}`}
            onClick={() => {
              workspace.selectSheet(sheet.id)
              if (chromeMode === 'select') workspace.setChromeMode('select')
            }}
          >
            {renaming ? (
              <input
                autoFocus
                className="inline-input"
                defaultValue={sheet.title}
                onClick={(event) => event.stopPropagation()}
                onBlur={(event) => {
                  workspace.renameSheet(sheet.id, event.target.value)
                  workspace.clearRename()
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') (event.target as HTMLInputElement).blur()
                  if (event.key === 'Escape') {
                    event.stopPropagation()
                    workspace.clearRename()
                  }
                }}
              />
            ) : (
              <span>{sheet.title}</span>
            )}
            {tabs.length > 1 ? (
              <i
                onClick={(event) => {
                  event.stopPropagation()
                  workspace.closeTab(sheet.id)
                }}
              >
                ×
              </i>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
