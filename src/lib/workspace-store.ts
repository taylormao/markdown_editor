import { useSyncExternalStore } from 'react'
import type { Folder, Sheet, ViewMode, WorkspaceSnapshot } from '../types'
import { uid } from './id'
import { titleFromContent } from './document-tree'
import { loadWorkspace, saveWorkspace } from './storage'

type WorkspaceState = WorkspaceSnapshot & {
  view: ViewMode
  sidebarOpen: boolean
  focusMode: boolean
  query: string
  saveState: 'idle' | 'saving' | 'saved'
}

type Listener = () => void

const listeners = new Set<Listener>()
let persistTimer = 0
let savedTimer = 0

const initial = loadWorkspace()

let state: WorkspaceState = {
  ...initial,
  view: 'write',
  sidebarOpen: true,
  focusMode: false,
  query: '',
  saveState: 'saved',
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
      focusMode: false,
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
}

export function useWorkspace() {
  return useSyncExternalStore(workspace.subscribe, workspace.get, workspace.get)
}
