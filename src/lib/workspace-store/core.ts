import type { WorkspaceSnapshot } from '../../types'
import { saveWorkspace } from '../storage'
import { seedSnapshot } from '../workspace-io'
import type { Core, Listener, WorkspaceState } from './types'

// core：工作区状态的唯一所有者。
// 持有 state、listeners 与三个定时器；对外暴露 get/set/toast/persistSoon/currentSnapshot/subscribe。
// 逻辑与原 workspace-store.ts 内联版本完全一致（行为不变）。

const initial = seedSnapshot()

let state: WorkspaceState = {
  ...initial,
  openTabIds: initial.openTabIds,
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
  templatePickerFor: null,
  templatePickerMode: 'folder',
  templatePickerType: null,
  yamlEditorOpen: false,
  yamlIssues: [],
  hydrated: false,
  config: { superPassword: '' },
  passwordGateLabel: '',
  startupStep: null,
  finishWritingIds: [],
  searchOpen: false,
  searchQuery: '',
  searchResults: [],
}

const listeners = new Set<Listener>()
let persistTimer = 0
let savedTimer = 0
let toastTimer = 0

function emit() {
  listeners.forEach((listener) => listener())
}

function persistSoon() {
  if (!state.hydrated) return
  state = { ...state, saveState: 'saving' }
  emit()
  window.clearTimeout(persistTimer)
  persistTimer = window.setTimeout(() => {
    const snapshot = currentSnapshot()
    void saveWorkspace(snapshot).then(() => {
      state = { ...state, saveState: 'saved' }
      emit()
      window.clearTimeout(savedTimer)
      savedTimer = window.setTimeout(() => {
        if (state.saveState === 'saved') {
          state = { ...state, saveState: 'idle' }
          emit()
        }
      }, 1600)
    })
  }, 420)
}

function currentSnapshot(): WorkspaceSnapshot {
  return {
    folders: state.folders,
    sheets: state.sheets,
    activeFolderId: state.activeFolderId,
    activeSheetId: state.activeSheetId,
    openTabIds: state.openTabIds,
    theme: state.theme,
    tracking: state.tracking,
    disabledSystemFolderKeys: state.disabledSystemFolderKeys,
  }
}

function set(patch: Partial<WorkspaceState> | ((prev: WorkspaceState) => WorkspaceState), persist = false) {
  state = typeof patch === 'function' ? patch(state) : { ...state, ...patch }
  emit()
  if (persist) persistSoon()
}

function toast(message: string) {
  window.clearTimeout(toastTimer)
  set({ toast: message })
  toastTimer = window.setTimeout(() => {
    if (state.toast === message) set({ toast: '' })
  }, 1600)
}

function subscribe(listener: Listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export const core: Core = {
  get() {
    return state
  },
  set,
  emit,
  persistSoon,
  currentSnapshot,
  toast,
  subscribe,
}
