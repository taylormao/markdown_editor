import type { Folder, ManageItem, OutlineNode, Sheet } from '../types'
import { parseOutline } from './document-tree'

function flattenOutline(nodes: OutlineNode[]): OutlineNode[] {
  return nodes.flatMap((node) => [node, ...flattenOutline(node.children)])
}

export function buildManageList(
  folders: Folder[],
  sheets: Sheet[],
  activeFolderId: string,
  collapsedFolderIds: string[],
  expandedSheetIds: string[],
): ManageItem[] {
  const items: ManageItem[] = folders.map((folder) => ({ kind: 'folder', id: folder.id }))
  if (collapsedFolderIds.includes(activeFolderId)) return items

  const visible = sheets
    .filter((sheet) => sheet.folderId === activeFolderId)
    .sort((a, b) => Number(b.starred) - Number(a.starred) || b.updatedAt - a.updatedAt)

  visible.forEach((sheet) => {
    items.push({ kind: 'sheet', id: sheet.id })
    if (!expandedSheetIds.includes(sheet.id)) return
    flattenOutline(parseOutline(sheet.content)).forEach((node) => {
      items.push({ kind: 'outline', sheetId: sheet.id, line: node.line, text: node.text })
    })
  })

  return items
}

export function manageLabel(item: ManageItem, folders: Folder[], sheets: Sheet[]): string {
  if (item.kind === 'folder') return folders.find((folder) => folder.id === item.id)?.name ?? '文件夹'
  if (item.kind === 'sheet') return sheets.find((sheet) => sheet.id === item.id)?.title ?? '文稿'
  return item.text
}
