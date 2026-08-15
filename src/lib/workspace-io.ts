import type { Folder, Sheet, WorkspaceSnapshot } from '../types'
import { createSeed } from './sample'

export const WORKSPACE_VERSION = 2

export type WorkspaceFile = WorkspaceSnapshot & {
  version: number
}

export function normalizeSnapshot(raw: Partial<WorkspaceSnapshot> | null | undefined): WorkspaceSnapshot | null {
  if (!raw?.folders?.length) return null
  const folders = raw.folders.map((folder, index) => ({
    id: folder.id,
    name: folder.name || '未命名文件夹',
    order: folder.order ?? index,
    parentId: folder.parentId ?? null,
  }))
  const folderIds = new Set(folders.map((folder) => folder.id))
  const sheets = (raw.sheets ?? []).map((sheet) => ({
    ...sheet,
    folderId: folderIds.has(sheet.folderId) ? sheet.folderId : folders[0].id,
    title: sheet.title || '未命名文稿',
    content: sheet.content ?? '',
    createdAt: sheet.createdAt ?? Date.now(),
    updatedAt: sheet.updatedAt ?? Date.now(),
    starred: Boolean(sheet.starred),
  }))
  if (!sheets.length) return null
  const sheetIds = new Set(sheets.map((sheet) => sheet.id))
  const activeSheetId = sheetIds.has(raw.activeSheetId ?? '') ? raw.activeSheetId! : sheets[0].id
  const activeFolderId = folderIds.has(raw.activeFolderId ?? '')
    ? raw.activeFolderId!
    : sheets.find((sheet) => sheet.id === activeSheetId)?.folderId ?? folders[0].id
  const openTabIds = (raw.openTabIds ?? [activeSheetId]).filter((id) => sheetIds.has(id))
  return {
    folders,
    sheets,
    activeFolderId,
    activeSheetId,
    openTabIds: openTabIds.length ? openTabIds : [activeSheetId],
    theme: raw.theme === 'light' || raw.theme === 'dark' ? raw.theme : 'system',
  }
}

export function toWorkspaceFile(snapshot: WorkspaceSnapshot): WorkspaceFile {
  return { version: WORKSPACE_VERSION, ...snapshot }
}

export function seedSnapshot(): WorkspaceSnapshot {
  const seed = createSeed()
  return {
    folders: seed.folders,
    sheets: seed.sheets,
    activeFolderId: seed.folders[1]?.id ?? seed.folders[0].id,
    activeSheetId: seed.sheets[0].id,
    openTabIds: [seed.sheets[0].id],
    theme: 'system',
  }
}

export function folderPath(folders: Folder[], id: string): Folder[] {
  const map = new Map(folders.map((folder) => [folder.id, folder]))
  const chain: Folder[] = []
  const seen = new Set<string>()
  let current = map.get(id)
  while (current && !seen.has(current.id)) {
    seen.add(current.id)
    chain.unshift(current)
    current = current.parentId ? map.get(current.parentId) : undefined
  }
  return chain
}

export function parseBackup(raw: string): WorkspaceSnapshot | null {
  try {
    const parsed = JSON.parse(raw) as Partial<WorkspaceFile>
    return normalizeSnapshot(parsed)
  } catch {
    return null
  }
}

export type { Folder, Sheet }
