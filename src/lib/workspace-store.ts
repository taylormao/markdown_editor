import { useSyncExternalStore } from 'react'
import type { ChromeMode, Folder, ManageItem, RenameTarget, Sheet, ViewMode, WorkspaceSnapshot } from '../types'
import { buildManageList } from './manage-list'
import { uid } from './id'
import { titleFromContent } from './document-tree'
import { loadWorkspace, saveWorkspace } from './storage'

type WorkspaceState = WorkspaceSnapshot & {
  view: ViewMode
  sidebarOpen: boolean
  focusMode: boolean
  query: string
  saveState: 'idle' | 'saving' | 'saved'
  chromeMode: ChromeMode
  caretBySheet: Record<string, number>
  caret: { line: number; col: number }
  toast: string
  collapsedFolderIds: string[]
  expandedSheetIds: string[]
  manageIndex: number
  renameTarget: RenameTarget | null
}

type Listener = () => void

const listeners = new Set<Listener>()
let persistTimer = 0
let savedTimer = 0
let toastTimer = 0

const initial = loadWorkspace()

let state: WorkspaceState = {
  ...initial,
  openTabIds: initial.openTabIds?.length ? initial.openTabIds : [initial.activeSheetId].filter(Boolean),
  view: 'write',
  sidebarOpen: true,
  focusMode: false,
  query: '',
  saveState: 'saved',
  chromeMode: 'edit',
  caretBySheet: {},
  caret: { line: 1, col: 1 },
  toast: '',
  collapsedFolderIds: [],
  expandedSheetIds: [],
  manageIndex: 0,
  renameTarget: null,
}

function emit() {
  listeners.forEach((listener) => listener())
}

function persistSoon() {
  state = { ...state, saveState: 'saving' }
  emit()
  window.clearTimeout(persistTimer)
  persistTimer = window.setTimeout(() => {
    const snapshot: WorkspaceSnapshot = {
      folders: state.folders,
      sheets: state.sheets,
      activeFolderId: state.activeFolderId,
      activeSheetId: state.activeSheetId,
      openTabIds: state.openTabIds,
      theme: state.theme,
    }
    saveWorkspace(snapshot)
    state = { ...state, saveState: 'saved' }
    emit()
    window.clearTimeout(savedTimer)
    savedTimer = window.setTimeout(() => {
      if (state.saveState === 'saved') {
        state = { ...state, saveState: 'idle' }
        emit()
      }
    }, 1600)
  }, 420)
}

function setState(patch: Partial<WorkspaceState> | ((prev: WorkspaceState) => WorkspaceState), persist = false) {
  state = typeof patch === 'function' ? patch(state) : { ...state, ...patch }
  emit()
  if (persist) persistSoon()
}

function toast(message: string) {
  window.clearTimeout(toastTimer)
  setState({ toast: message })
  toastTimer = window.setTimeout(() => {
    if (state.toast === message) setState({ toast: '' })
  }, 1600)
}

function manageItems() {
  return buildManageList(state.folders, state.sheets, state.activeFolderId, state.collapsedFolderIds, state.expandedSheetIds)
}

function lineToPos(content: string, line: number): number {
  const lines = content.split('\n')
  let pos = 0
  for (let i = 0; i < Math.max(0, line - 1) && i < lines.length; i++) pos += lines[i].length + 1
  return pos
}

export const workspace = {
  subscribe(listener: Listener) {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
  get() {
    return state
  },
  selectFolder(id: string) {
    const first = state.sheets.find((sheet) => sheet.folderId === id)
    setState({
      activeFolderId: id,
      activeSheetId: first?.id ?? state.activeSheetId,
      openTabIds: first ? Array.from(new Set([...state.openTabIds, first.id])) : state.openTabIds,
      sidebarOpen: true,
      focusMode: false,
    })
  },
  selectSheet(id: string) {
    const sheet = state.sheets.find((item) => item.id === id)
    if (!sheet) return
    setState({
      activeSheetId: id,
      activeFolderId: sheet.folderId,
      openTabIds: state.openTabIds.includes(id) ? state.openTabIds : [...state.openTabIds, id],
      focusMode: false,
      chromeMode: state.chromeMode === 'manage' ? 'manage' : state.chromeMode,
    })
  },
  openSheetByTitle(title: string) {
    const needle = title.trim().toLowerCase()
    const sheet = state.sheets.find((item) => item.title.trim().toLowerCase() === needle)
    if (!sheet) return
    setState({
      activeSheetId: sheet.id,
      activeFolderId: sheet.folderId,
      openTabIds: state.openTabIds.includes(sheet.id) ? state.openTabIds : [...state.openTabIds, sheet.id],
      view: 'write',
      focusMode: false,
    })
  },
  closeTab(id: string) {
    const remaining = state.openTabIds.filter((tab) => tab !== id)
    const nextId = state.activeSheetId === id ? remaining[remaining.length - 1] : state.activeSheetId
    const next = state.sheets.find((sheet) => sheet.id === nextId)
    setState({
      openTabIds: remaining,
      activeSheetId: next?.id ?? state.activeSheetId,
      activeFolderId: next?.folderId ?? state.activeFolderId,
    })
  },
  createFolder() {
    const folder: Folder = { id: uid(), name: '新文件夹', order: state.folders.length }
    setState({ folders: [...state.folders, folder], activeFolderId: folder.id }, true)
  },
  renameFolder(id: string, name: string) {
    setState(
      {
        folders: state.folders.map((folder) => (folder.id === id ? { ...folder, name } : folder)),
      },
      true,
    )
  },
  deleteFolder(id: string) {
    if (state.folders.length <= 1) return
    const leftover = state.folders.filter((folder) => folder.id !== id)
    const fallback = leftover[0]
    const sheets = state.sheets.map((sheet) => (sheet.folderId === id ? { ...sheet, folderId: fallback.id } : sheet))
    setState(
      {
        folders: leftover,
        sheets,
        activeFolderId: state.activeFolderId === id ? fallback.id : state.activeFolderId,
      },
      true,
    )
  },
  renameSheet(id: string, title: string) {
    const next = title.trim() || '未命名文稿'
    setState(
      {
        sheets: state.sheets.map((sheet) => {
          if (sheet.id !== id) return sheet
          const lines = sheet.content.split('\n')
          const first = lines.findIndex((line) => line.trim().length > 0)
          if (first >= 0) {
            const marks = lines[first].match(/^#+/)
            lines[first] = marks ? `${marks[0]} ${next}` : `# ${next}`
          } else {
            lines.unshift(`# ${next}`)
          }
          return { ...sheet, title: next, content: lines.join('\n'), updatedAt: Date.now() }
        }),
      },
      true,
    )
  },
  createSheet(folderId = state.activeFolderId) {
    const now = Date.now()
    const sheet: Sheet = {
      id: uid(),
      folderId,
      title: '未命名文稿',
      content: '',
      createdAt: now,
      updatedAt: now,
      starred: false,
    }
    setState(
      {
        sheets: [sheet, ...state.sheets],
        activeFolderId: folderId,
        activeSheetId: sheet.id,
        openTabIds: [sheet.id, ...state.openTabIds.filter((tab) => tab !== sheet.id)],
        view: 'write',
        focusMode: false,
      },
      true,
    )
  },
  updateSheetContent(id: string, content: string) {
    const title = titleFromContent(content)
    setState(
      {
        sheets: state.sheets.map((sheet) =>
          sheet.id === id ? { ...sheet, content, title, updatedAt: Date.now() } : sheet,
        ),
      },
      true,
    )
  },
  toggleStar(id: string) {
    setState(
      {
        sheets: state.sheets.map((sheet) => (sheet.id === id ? { ...sheet, starred: !sheet.starred } : sheet)),
      },
      true,
    )
  },
  moveSheet(id: string, folderId: string) {
    setState(
      {
        sheets: state.sheets.map((sheet) => (sheet.id === id ? { ...sheet, folderId, updatedAt: Date.now() } : sheet)),
        activeFolderId: folderId,
      },
      true,
    )
  },
  deleteSheet(id: string) {
    const remaining = state.sheets.filter((sheet) => sheet.id !== id)
    const next = remaining.find((sheet) => sheet.folderId === state.activeFolderId) ?? remaining[0]
    setState(
      {
        sheets: remaining,
        activeSheetId: next?.id ?? '',
        openTabIds: state.openTabIds.filter((tab) => tab !== id),
      },
      true,
    )
  },
  setView(view: ViewMode) {
    setState({ view, focusMode: false })
  },
  setQuery(query: string) {
    setState({ query })
  },
  toggleSidebar() {
    setState({ sidebarOpen: !state.sidebarOpen, focusMode: false })
  },
  toggleFocus() {
    const next = !state.focusMode
    setState({ focusMode: next, sidebarOpen: next ? false : state.sidebarOpen })
  },
  cycleTheme() {
    const order = ['system', 'light', 'dark'] as const
    const next = order[(order.indexOf(state.theme) + 1) % order.length]
    setState({ theme: next }, true)
  },
  setCaret(sheetId: string, pos: number, line: number, col: number) {
    setState({
      caretBySheet: { ...state.caretBySheet, [sheetId]: pos },
      caret: { line, col },
    })
  },
  setChromeMode(mode: ChromeMode, message?: string) {
    const patch: Partial<WorkspaceState> = { chromeMode: mode, renameTarget: null }
    if (mode === 'select') {
      patch.sidebarOpen = true
      patch.focusMode = false
      patch.view = 'write'
    }
    if (mode === 'manage') {
      patch.sidebarOpen = true
      patch.focusMode = false
      const items = manageItems()
      const current = items.findIndex((item) => item.kind === 'sheet' && item.id === state.activeSheetId)
      const folder = items.findIndex((item) => item.kind === 'folder' && item.id === state.activeFolderId)
      patch.manageIndex = current >= 0 ? current : Math.max(0, folder)
    }
    setState(patch)
    if (message) toast(message)
  },
  cycleChromeMode() {
    if (state.chromeMode === 'edit') workspace.setChromeMode('select', '进入标签选择模式')
    else if (state.chromeMode === 'select') workspace.setChromeMode('manage', '进入管理模式')
    else workspace.setChromeMode('edit', '进入编辑模式')
  },
  nextTab() {
    const tabs = state.openTabIds.filter((id) => state.sheets.some((sheet) => sheet.id === id))
    if (!tabs.length) return
    const index = Math.max(0, tabs.indexOf(state.activeSheetId))
    const next = tabs[(index + 1) % tabs.length]
    workspace.selectSheet(next)
    setState({ chromeMode: 'select' })
  },
  openAtLine(sheetId: string, line: number) {
    const sheet = state.sheets.find((item) => item.id === sheetId)
    if (!sheet) return
    const pos = lineToPos(sheet.content, line)
    setState({
      activeSheetId: sheetId,
      activeFolderId: sheet.folderId,
      openTabIds: state.openTabIds.includes(sheetId) ? state.openTabIds : [...state.openTabIds, sheetId],
      caretBySheet: { ...state.caretBySheet, [sheetId]: pos },
      view: 'write',
      chromeMode: 'edit',
      focusMode: false,
    })
    toast('进入编辑模式')
  },
  requestRename(target: RenameTarget) {
    setState({ renameTarget: target })
  },
  clearRename() {
    setState({ renameTarget: null })
  },
  moveManage(delta: number) {
    const items = manageItems()
    if (!items.length) return
    const next = (state.manageIndex + delta + items.length) % items.length
    const item = items[next]
    const patch: Partial<WorkspaceState> = { manageIndex: next, chromeMode: 'manage' }
    if (item.kind === 'folder') patch.activeFolderId = item.id
    if (item.kind === 'sheet') {
      patch.activeSheetId = item.id
      patch.activeFolderId = state.sheets.find((sheet) => sheet.id === item.id)?.folderId ?? state.activeFolderId
    }
    if (item.kind === 'outline') {
      patch.activeSheetId = item.sheetId
      patch.activeFolderId = state.sheets.find((sheet) => sheet.id === item.sheetId)?.folderId ?? state.activeFolderId
    }
    setState(patch)
  },
  currentManageItem(): ManageItem | null {
    return manageItems()[state.manageIndex] ?? null
  },
  toggleManageExpand() {
    const item = manageItems()[state.manageIndex]
    if (!item) return
    if (item.kind === 'folder') {
      const collapsed = state.collapsedFolderIds.includes(item.id)
        ? state.collapsedFolderIds.filter((id) => id !== item.id)
        : [...state.collapsedFolderIds, item.id]
      setState({ collapsedFolderIds: collapsed, activeFolderId: item.id })
    }
    if (item.kind === 'sheet') {
      const expanded = state.expandedSheetIds.includes(item.id)
        ? state.expandedSheetIds.filter((id) => id !== item.id)
        : [...state.expandedSheetIds, item.id]
      setState({ expandedSheetIds: expanded })
    }
  },
  collapseManage() {
    const item = manageItems()[state.manageIndex]
    if (!item) return
    if (item.kind === 'folder' && !state.collapsedFolderIds.includes(item.id)) {
      setState({ collapsedFolderIds: [...state.collapsedFolderIds, item.id], activeFolderId: item.id })
      return
    }
    if (item.kind === 'sheet' && state.expandedSheetIds.includes(item.id)) {
      setState({ expandedSheetIds: state.expandedSheetIds.filter((id) => id !== item.id) })
      return
    }
    if (item.kind === 'sheet' || item.kind === 'outline') {
      const folderId = item.kind === 'sheet'
        ? state.sheets.find((sheet) => sheet.id === item.id)?.folderId
        : state.sheets.find((sheet) => sheet.id === item.sheetId)?.folderId
      if (!folderId) return
      const items = manageItems()
      const folderIndex = items.findIndex((entry) => entry.kind === 'folder' && entry.id === folderId)
      setState({
        collapsedFolderIds: state.collapsedFolderIds.includes(folderId) ? state.collapsedFolderIds : [...state.collapsedFolderIds, folderId],
        activeFolderId: folderId,
        manageIndex: Math.max(0, folderIndex),
      })
    }
  },
  expandManage() {
    const item = manageItems()[state.manageIndex]
    if (!item) return
    if (item.kind === 'folder') {
      setState({
        collapsedFolderIds: state.collapsedFolderIds.filter((id) => id !== item.id),
        activeFolderId: item.id,
      })
    }
    if (item.kind === 'sheet' && !state.expandedSheetIds.includes(item.id)) {
      setState({ expandedSheetIds: [...state.expandedSheetIds, item.id] })
    }
  },
  confirmManage() {
    const item = manageItems()[state.manageIndex]
    if (!item) return
    if (item.kind === 'folder') {
      workspace.selectFolder(item.id)
      return
    }
    const sheetId = item.kind === 'sheet' ? item.id : item.sheetId
    const sheet = state.sheets.find((entry) => entry.id === sheetId)
    if (!sheet) return
    const pos = item.kind === 'outline' ? lineToPos(sheet.content, item.line) : state.caretBySheet[sheetId] ?? 0
    setState({
      activeSheetId: sheetId,
      activeFolderId: sheet.folderId,
      openTabIds: state.openTabIds.includes(sheetId) ? state.openTabIds : [...state.openTabIds, sheetId],
      caretBySheet: { ...state.caretBySheet, [sheetId]: pos },
      view: 'write',
      chromeMode: 'edit',
      focusMode: false,
    })
    toast('进入编辑模式')
  },
}

export function useWorkspace() {
  return useSyncExternalStore(workspace.subscribe, workspace.get, workspace.get)
}
