import type { WorkspaceSnapshot } from '../types'
import { createSeed } from './sample'

const KEY = 'folio.workspace.v1'

export function loadWorkspace(): WorkspaceSnapshot {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as WorkspaceSnapshot
      if (parsed.folders?.length && parsed.sheets?.length) return parsed
    }
  } catch {
    /* ignore corrupt cache */
  }

  const seed = createSeed()
  return {
    folders: seed.folders,
    sheets: seed.sheets,
    activeFolderId: seed.folders[1]?.id ?? seed.folders[0].id,
    activeSheetId: seed.sheets[0].id,
    theme: 'system',
  }
}

export function saveWorkspace(snapshot: WorkspaceSnapshot): void {
  localStorage.setItem(KEY, JSON.stringify(snapshot))
}
