import type { DocType } from './templates'
import type { Folder, Sheet, SystemFolderKey } from '../types'

type FolderDef = {
  key: SystemFolderKey
  name: string
  order: number
  parent?: SystemFolderKey
  docType?: DocType
}

const DEFINITIONS: readonly FolderDef[] = [
  { key: 'inbox', name: '收集箱', order: 0 },
  { key: 'templates', name: '000-模板', order: 1 },
  { key: 'projects', name: '100-项目', order: 2 },
  { key: 'project', name: '110-项目', order: 0, parent: 'projects', docType: 'project' },
  { key: 'meeting', name: '120-会议', order: 1, parent: 'projects', docType: 'meeting' },
  { key: 'areas', name: '200-领域', order: 3 },
  { key: 'daily', name: '210-每日', order: 0, parent: 'areas', docType: 'daily' },
  { key: 'review', name: '220-复盘', order: 1, parent: 'areas', docType: 'review' },
  { key: 'resources', name: '300-资源', order: 4 },
  { key: 'video', name: '310-视频', order: 0, parent: 'resources', docType: 'video' },
  { key: 'literature', name: '320-读书', order: 1, parent: 'resources', docType: 'literature' },
  { key: 'clip', name: '330-收藏', order: 2, parent: 'resources', docType: 'clip' },
  { key: 'publish', name: '340-publish', order: 3, parent: 'resources', docType: 'tutorial' },
  { key: 'archives', name: '400-归档', order: 5 },
  { key: 'uncategorized', name: '999-未分类', order: 6 },
] as const

const fixedId = (key: SystemFolderKey) => `folio-system-${key}`

export function ensureSystemFolders(folders: Folder[], sheets: Sheet[], disabledKeys: readonly SystemFolderKey[] = []): { folders: Folder[]; sheets: Sheet[] } {
  const result = folders.map((folder) => ({ ...folder }))
  const byKey = new Map<SystemFolderKey, Folder>()
  result.forEach((folder) => {
    if (folder.systemKey) byKey.set(folder.systemKey, folder)
  })

  const inbox = byKey.get('inbox') ?? result.find((folder) => folder.name === '收集箱')
  if (inbox) {
    inbox.systemKey = 'inbox'
    inbox.name = '收集箱'
    inbox.parentId = null
    inbox.order = 0
    byKey.set('inbox', inbox)
  }
  const oldWriting = result.find((folder) => folder.name === '文稿' && !folder.systemKey)
  if (oldWriting) {
    oldWriting.systemKey = 'uncategorized'
    oldWriting.name = '999-未分类'
    oldWriting.parentId = null
    byKey.set('uncategorized', oldWriting)
  }

  const disabled = new Set(disabledKeys)
  for (const def of DEFINITIONS) {
    if (disabled.has(def.key)) continue
    let folder = byKey.get(def.key)
    if (!folder) {
      folder = { id: fixedId(def.key), name: def.name, order: def.order, parentId: null, systemKey: def.key }
      result.push(folder)
      byKey.set(def.key, folder)
    }
    folder.name = def.name
    folder.order = def.order
    folder.parentId = def.parent ? byKey.get(def.parent)?.id ?? null : null
    folder.docType = def.docType
  }

  const folderIds = new Set(result.map((folder) => folder.id))
  const fallbackId = byKey.get('uncategorized')?.id ?? byKey.get('inbox')?.id ?? result[0]?.id ?? ''
  return {
    folders: result,
    sheets: sheets.map((sheet) => (folderIds.has(sheet.folderId) ? sheet : { ...sheet, folderId: fallbackId })),
  }
}

export function systemFolder(folders: Folder[], key: SystemFolderKey): Folder | undefined {
  return folders.find((folder) => folder.systemKey === key)
}

export function destinationForType(folders: Folder[], type: string): Folder | undefined {
  return folders.find((folder) => folder.docType === type)
}

export function isSystemFolder(folder: Folder | undefined): boolean {
  return Boolean(folder?.systemKey)
}
