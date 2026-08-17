import type { WorkspaceSnapshot } from '../types'
import { normalizeSnapshot, parseBackup, seedSnapshot, toWorkspaceFile } from './workspace-io'

const KEY = 'folio.workspace.v1'

function fromCache(): WorkspaceSnapshot | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    return normalizeSnapshot(JSON.parse(raw))
  } catch {
    return null
  }
}

export async function loadWorkspace(): Promise<WorkspaceSnapshot> {
  try {
    const res = await fetch('/api/workspace')
    if (res.ok) {
      const parsed = normalizeSnapshot(await res.json())
      if (parsed) {
        localStorage.setItem(KEY, JSON.stringify(parsed))
        return parsed
      }
    }
  } catch {
    /* fall through */
  }
  return fromCache() ?? seedSnapshot()
}

export async function saveWorkspace(snapshot: WorkspaceSnapshot, keepalive = false): Promise<void> {
  const file = toWorkspaceFile(snapshot)
  localStorage.setItem(KEY, JSON.stringify(file))
  try {
    await fetch('/api/workspace', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(file),
      keepalive,
    })
  } catch {
    /* keep browser cache if disk API is down */
  }
}

export function exportBackup(snapshot: WorkspaceSnapshot): void {
  const blob = new Blob([JSON.stringify(toWorkspaceFile(snapshot), null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `folio-backup-${new Date().toISOString().slice(0, 10)}.json`
  link.click()
  URL.revokeObjectURL(url)
}

export function importBackupFile(file: File): Promise<WorkspaceSnapshot> {
  return file.text().then((raw) => {
    const parsed = parseBackup(raw)
    if (!parsed) throw new Error('invalid backup')
    return parsed
  })
}
