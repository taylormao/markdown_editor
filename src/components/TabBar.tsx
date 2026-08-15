import { workspace } from '../lib/workspace-store'
import type { Sheet } from '../types'

type Props = {
  sheets: Sheet[]
  openTabIds: string[]
  activeSheetId: string
}

export function TabBar({ sheets, openTabIds, activeSheetId }: Props) {
  const tabs = openTabIds
    .map((id) => sheets.find((sheet) => sheet.id === id))
    .filter((sheet): sheet is Sheet => Boolean(sheet))

  if (tabs.length === 0) return null

  return (
    <div className="tab-bar">
      {tabs.map((sheet) => (
        <button
          key={sheet.id}
          className={`tab-item ${sheet.id === activeSheetId ? 'is-active' : ''}`}
          onClick={() => workspace.selectSheet(sheet.id)}
        >
          <span>{sheet.title}</span>
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
      ))}
    </div>
  )
}
