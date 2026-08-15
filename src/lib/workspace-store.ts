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
  openTabIds: initial.openTabIds?.length ? initial.openTabIds : [initial.activeSheetId].filter(Boolean),
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
}

export function useWorkspace() {
  return useSyncExternalStore(workspace.subscribe, workspace.get, workspace.get)
}
