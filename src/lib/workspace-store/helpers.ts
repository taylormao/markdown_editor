import type { Folder, Sheet } from '../../types'
import type { ValidationIssue } from '../templates'
import { asString, splitFrontmatter } from '../frontmatter'
import { validateDoc } from '../templates'
import { systemFolder } from '../workspace-folders'
import { buildManageList } from '../manage-list'

// 纯函数层：所有输入显式传参，不依赖模块级 state。
// 供 workspace-store 各 slice 复用；逻辑与原 workspace-store.ts 内联版本完全一致。

export function lineToPos(content: string, line: number): number {
  const lines = content.split('\n')
  let pos = 0
  for (let i = 0; i < Math.max(0, line - 1) && i < lines.length; i++) pos += lines[i].length + 1
  return pos
}

export function sheetType(sheet: Sheet): string {
  return asString(splitFrontmatter(sheet.content).attrs.type)
}

export function isTrackedSheetIn(folders: Folder[], sheet: Sheet): boolean {
  return sheet.folderId === systemFolder(folders, 'inbox')?.id && sheetType(sheet) !== 'spark'
}

export function computeIssues(sheets: Sheet[], activeSheetId: string): ValidationIssue[] {
  const current = sheets.find((item) => item.id === activeSheetId)
  if (!current) return []
  const doc = splitFrontmatter(current.content)
  return validateDoc(doc.attrs, doc.body)
}

export function manageItemsIn(
  folders: Folder[],
  sheets: Sheet[],
  activeFolderId: string,
  collapsedFolderIds: string[],
  expandedSheetIds: string[],
) {
  return buildManageList(folders, sheets, activeFolderId, collapsedFolderIds, expandedSheetIds)
}