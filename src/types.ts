export type ViewMode = 'write' | 'preview' | 'outline' | 'map'
export type ChromeMode = 'edit' | 'select' | 'manage'
export type ManageItem =
  | { kind: 'folder'; id: string }
  | { kind: 'sheet'; id: string }
  | { kind: 'outline'; sheetId: string; line: number; text: string }
export type RenameTarget = { kind: 'folder' | 'sheet'; id: string }

export type Folder = {
  id: string
  name: string
  order: number
}

export type Sheet = {
  id: string
  folderId: string
  title: string
  content: string
  createdAt: number
  updatedAt: number
  starred: boolean
}

export type OutlineNode = {
  id: string
  level: number
  text: string
  line: number
  children: OutlineNode[]
}

export type WorkspaceSnapshot = {
  folders: Folder[]
  sheets: Sheet[]
  activeFolderId: string
  activeSheetId: string
  openTabIds: string[]
  theme: 'system' | 'light' | 'dark'
}
