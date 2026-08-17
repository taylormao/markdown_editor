import { useSyncExternalStore } from 'react'
import type { ChromeMode, Folder, ManageItem, RenameTarget, Sheet, ViewMode, WorkspaceSnapshot } from '../types'
import { buildManageList } from './manage-list'
import { uid } from './id'
import { titleFromContent } from './document-tree'
import { asString, splitFrontmatter, stringifyFrontmatter, todayStamp } from './frontmatter'
import { exportBackup as downloadBackup, importBackupFile, loadWorkspace, saveWorkspace } from './storage'
import { buildTemplateContent, templateById, validateDoc, type DocType, type TemplateId, type ValidationIssue } from './templates'
import { seedSnapshot } from './workspace-io'
import { collectWikiRefs, mergeRelated, normalizeWikiRefs, resolveWikiRef } from './wiki-scan'
import { destinationForType, ensureSystemFolders, isSystemFolder, systemFolder } from './workspace-folders'
import { fingerprintSheet } from './sheet-tracking'
import { loadConfig, saveConfig, type FolioConfig } from './config-storage'

type PickerMode = 'folder' | 'quick'
type StartupStep = 'classify' | 'continue' | null
type ProtectedAction = { label: string; run: () => void }

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
  templatePickerFor: string | null
  templatePickerMode: PickerMode
  templatePickerType: DocType | null
  yamlEditorOpen: boolean
  yamlIssues: ValidationIssue[]
  hydrated: boolean
  config: FolioConfig
  passwordGateLabel: string
  startupStep: StartupStep
  finishWritingIds: string[]
}

type Listener = () => void

const listeners = new Set<Listener>()
let persistTimer = 0
let savedTimer = 0
let toastTimer = 0
let protectedAction: ProtectedAction | null = null
const sessionBaselines = new Map<string, Promise<string>>()
const createdThisSession = new Set<string>()
const touchedThisSession = new Set<string>()

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
}

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

function currentIssues(): ValidationIssue[] {
  const current = state.sheets.find((item) => item.id === state.activeSheetId)
  if (!current) return []
  const doc = splitFrontmatter(current.content)
  return validateDoc(doc.attrs, doc.body)
}

function blockLeave(nextId?: string): boolean {
  if (nextId && nextId === state.activeSheetId) return false
  const issues = currentIssues()
  if (!issues.length) return false
  setState({ yamlIssues: issues })
  toast('当前文稿缺必填字段，不能切走')
  return true
}

function lineToPos(content: string, line: number): number {
  const lines = content.split('\n')
  let pos = 0
  for (let i = 0; i < Math.max(0, line - 1) && i < lines.length; i++) pos += lines[i].length + 1
  return pos
}

function sheetType(sheet: Sheet): string {
  return asString(splitFrontmatter(sheet.content).attrs.type)
}

function isTrackedSheet(sheet: Sheet): boolean {
  return sheet.folderId === systemFolder(state.folders, 'inbox')?.id && sheetType(sheet) !== 'spark'
}

function beginTracking(id: string) {
  const sheet = state.sheets.find((item) => item.id === id)
  if (!sheet || !isTrackedSheet(sheet) || sessionBaselines.has(id)) return
  const snapshot = { ...sheet }
  sessionBaselines.set(id, fingerprintSheet(snapshot))
}

function markTouched(id: string) {
  const sheet = state.sheets.find((item) => item.id === id)
  if (!sheet || !isTrackedSheet(sheet)) return
  beginTracking(id)
  touchedThisSession.add(id)
  const baseline = sessionBaselines.get(id)
  if (!baseline) return
  void baseline.then((fingerprint) => {
    const sheetNow = state.sheets.find((item) => item.id === id)
    if (!sheetNow || !isTrackedSheet(sheetNow)) return
    const tracking = state.tracking[id]
    if (tracking?.baselineFingerprint) return
    setState({
      tracking: {
        ...state.tracking,
        [id]: { baselineFingerprint: fingerprint, touched: true, pendingClassification: tracking?.pendingClassification ?? false },
      },
    }, true)
  })
}

function runProtected(label: string, run: () => void) {
  protectedAction = { label, run }
  setState({ passwordGateLabel: label })
}

function clearTracking(id: string) {
  sessionBaselines.delete(id)
  touchedThisSession.delete(id)
  createdThisSession.delete(id)
  const tracking = { ...state.tracking }
  delete tracking[id]
  return tracking
}

function selectSheetState(sheet: Sheet) {
  beginTracking(sheet.id)
  setState({
    activeSheetId: sheet.id,
    activeFolderId: sheet.folderId,
    openTabIds: state.openTabIds.includes(sheet.id) ? state.openTabIds : [...state.openTabIds, sheet.id],
    view: 'write',
    focusMode: false,
    chromeMode: 'edit',
  })
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
    if (first && blockLeave(first.id)) return
    if (first) beginTracking(first.id)
    setState({
      activeFolderId: id,
      activeSheetId: first?.id ?? state.activeSheetId,
      openTabIds: first ? Array.from(new Set([...state.openTabIds, first.id])) : state.openTabIds,
      sidebarOpen: true,
      focusMode: false,
    })
  },
  selectSheet(id: string) {
    if (blockLeave(id)) return
    const sheet = state.sheets.find((item) => item.id === id)
    if (!sheet) return
    beginTracking(id)
    setState({
      activeSheetId: id,
      activeFolderId: sheet.folderId,
      openTabIds: state.openTabIds.includes(id) ? state.openTabIds : [...state.openTabIds, id],
      focusMode: false,
      chromeMode: state.chromeMode === 'manage' ? 'manage' : state.chromeMode,
    })
  },
  openSheetByTitle(title: string) {
    workspace.openWiki(title)
  },
  openWiki(ref: string) {
    const needle = ref.trim()
    const byId = state.sheets.find((item) => item.id === needle || asString(splitFrontmatter(item.content).attrs.id) === needle)
    const byTitle = state.sheets.find((item) => item.title.trim().toLowerCase() === needle.toLowerCase())
    const sheet = byId ?? byTitle
    if (!sheet) return
    if (blockLeave(sheet.id)) return
    selectSheetState(sheet)
  },
  closeTab(id: string) {
    if (id === state.activeSheetId && blockLeave()) return
    if (state.openTabIds.length === 1) {
      void workspace.prepareFinishWriting()
      return
    }
    const remaining = state.openTabIds.filter((tab) => tab !== id)
    const nextId = state.activeSheetId === id ? remaining[remaining.length - 1] : state.activeSheetId
    const next = state.sheets.find((sheet) => sheet.id === nextId)
    setState({
      openTabIds: remaining,
      activeSheetId: next?.id ?? state.activeSheetId,
      activeFolderId: next?.folderId ?? state.activeFolderId,
    })
  },
  createFolder(parentId: string | null = null) {
    const folder: Folder = { id: uid(), name: '新文件夹', order: state.folders.length, parentId }
    setState({ folders: [...state.folders, folder], activeFolderId: folder.id }, true)
    return folder.id
  },
  requestCreateFolder(parentId: string | null = null) {
    runProtected('创建子文件夹', () => workspace.createFolder(parentId))
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
    const doomed = new Set<string>()
    const walk = (fid: string) => {
      doomed.add(fid)
      state.folders.filter((folder) => folder.parentId === fid).forEach((child) => walk(child.id))
    }
    walk(id)
    const disabledSystemFolderKeys = Array.from(new Set([
      ...state.disabledSystemFolderKeys,
      ...state.folders.filter((folder) => doomed.has(folder.id)).map((folder) => folder.systemKey).filter((key): key is NonNullable<typeof key> => Boolean(key)),
    ]))
    const leftover = state.folders.filter((folder) => !doomed.has(folder.id))
    if (!leftover.length) return
    const fallback = leftover[0]
    const sheets = state.sheets.map((sheet) => (doomed.has(sheet.folderId) ? { ...sheet, folderId: fallback.id } : sheet))
    setState(
      {
        folders: leftover,
        sheets,
        activeFolderId: doomed.has(state.activeFolderId) ? fallback.id : state.activeFolderId,
        disabledSystemFolderKeys,
      },
      true,
    )
  },
  renameSheet(id: string, title: string) {
    markTouched(id)
    const next = title.trim() || '未命名文稿'
    setState(
      {
        sheets: state.sheets.map((sheet) => {
          if (sheet.id !== id) return sheet
          const doc = splitFrontmatter(sheet.content)
          if (doc.hasFence) {
            doc.attrs.title = next
            const heading = doc.body.replace(/^(#+\s+).+$/m, `$1${next}`)
            return {
              ...sheet,
              title: next,
              content: `${stringifyFrontmatter(doc.attrs)}\n${heading.startsWith('#') ? heading : `# ${next}\n\n${doc.body}`}`,
              updatedAt: Date.now(),
            }
          }
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
  requestRenameSheet(id: string, title: string) {
    runProtected('重命名文稿', () => workspace.renameSheet(id, title))
  },
  requestNewSheet(folderId = state.activeFolderId) {
    const folder = state.folders.find((item) => item.id === folderId)
    if (folder?.systemKey && !folder.docType && !['inbox', 'uncategorized'].includes(folder.systemKey)) {
      toast('请在具体 type 子目录中创建文稿')
      return
    }
    setState({
      templatePickerFor: folderId,
      templatePickerMode: 'folder',
      templatePickerType: folder?.docType as DocType | undefined ?? null,
      sidebarOpen: true,
      focusMode: false,
    })
  },
  requestQuickSheet() {
    setState({
      templatePickerFor: systemFolder(state.folders, 'inbox')?.id ?? state.activeFolderId,
      templatePickerMode: 'quick',
      templatePickerType: null,
      sidebarOpen: true,
      focusMode: false,
    })
  },
  selectTemplateType(type: DocType) {
    setState({ templatePickerType: type })
  },
  clearTemplateType() {
    setState({ templatePickerType: null })
  },
  closeTemplatePicker() {
    setState({ templatePickerFor: null, templatePickerType: null })
  },
  openYamlEditor() {
    if (state.chromeMode !== 'edit') return
    setState({ yamlEditorOpen: true })
  },
  closeYamlEditor() {
    setState({ yamlEditorOpen: false })
  },
  applyFrontmatter(id: string, attrs: Record<string, import('./frontmatter').YamlValue>) {
    const sheet = state.sheets.find((item) => item.id === id)
    if (!sheet) return
    const doc = splitFrontmatter(sheet.content)
    const related = mergeRelated(
      attrs.related ?? doc.attrs.related,
      collectWikiRefs(doc.body).map((ref) => resolveWikiRef(ref, state.sheets)),
    )
    const content = `${stringifyFrontmatter({ ...doc.attrs, ...attrs, related, updated: todayStamp() })}\n${doc.body}`
    workspace.updateSheetContent(id, content)
    const next = validateDoc(splitFrontmatter(content).attrs, doc.body)
    if (!next.length) setState({ yamlEditorOpen: false, yamlIssues: [] })
    else setState({ yamlIssues: next })
  },
  createSheetFromTemplate(templateId: TemplateId, folderId = state.templatePickerFor ?? state.activeFolderId) {
    const def = templateById(templateId)
    if (!def) return
    if (def.id === 'daily') {
      const date = todayStamp()
      const existing = state.sheets.find((sheet) => {
        const attrs = splitFrontmatter(sheet.content).attrs
        return asString(attrs.template) === 'daily' && asString(attrs.date) === date
      })
      if (existing) {
        setState({ templatePickerFor: null })
        workspace.selectSheet(existing.id)
        toast('今天的晚间笔记已存在，已打开')
        return
      }
    }
    const now = Date.now()
    const content = buildTemplateContent(def)
    const attrs = splitFrontmatter(content).attrs
    const sheet: Sheet = {
      id: asString(attrs.id) || uid(),
      folderId,
      title: titleFromContent(content),
      content,
      createdAt: now,
      updatedAt: now,
      starred: false,
    }
    const issues = validateDoc(attrs, splitFrontmatter(content).body)
    const quickPending = state.templatePickerMode === 'quick' && def.type !== 'spark'
    if (quickPending) createdThisSession.add(sheet.id)
    setState(
      {
        sheets: [sheet, ...state.sheets],
        activeFolderId: folderId,
        activeSheetId: sheet.id,
        openTabIds: [sheet.id, ...state.openTabIds.filter((tab) => tab !== sheet.id)],
        view: 'write',
        focusMode: false,
        chromeMode: 'edit',
        templatePickerFor: null,
        templatePickerType: null,
        tracking: quickPending
          ? { ...state.tracking, [sheet.id]: { touched: false, pendingClassification: true } }
          : state.tracking,
        yamlIssues: issues,
      },
      true,
    )
  },
  createSheet(folderId = state.activeFolderId) {
    workspace.requestNewSheet(folderId)
  },
  updateSheetContent(id: string, content: string) {
    const current = state.sheets.find((sheet) => sheet.id === id)
    if (!current) return
    if (current.content === content) return
    markTouched(id)
    let nextContent = content
    const initialDoc = splitFrontmatter(content)
    const normalizedBody = normalizeWikiRefs(initialDoc.body, state.sheets)
    if (initialDoc.hasFence && normalizedBody !== initialDoc.body) {
      nextContent = `${stringifyFrontmatter(initialDoc.attrs)}\n${normalizedBody}`
    }
    const scanned = collectWikiRefs(splitFrontmatter(nextContent).body)
    if (scanned.length) {
      const doc0 = splitFrontmatter(content)
      if (doc0.hasFence) {
        const related = mergeRelated(
          doc0.attrs.related,
          scanned.map((ref) => resolveWikiRef(ref, state.sheets)),
        )
        const prev = Array.isArray(doc0.attrs.related) ? doc0.attrs.related.map(String) : []
        const same = prev.length === related.length && related.every((item, index) => prev[index] === item)
        if (!same) {
          doc0.attrs.related = related
          nextContent = `${stringifyFrontmatter(doc0.attrs)}\n${doc0.body}`
        }
      }
    }
    const doc = splitFrontmatter(nextContent)
    const issues = validateDoc(doc.attrs, doc.body)
    const blocked = state.activeSheetId !== id && issues.length > 0
    if (blocked) {
      setState({ yamlIssues: issues })
      toast('当前文稿缺必填字段，先补完再离开')
      return
    }
    const title = titleFromContent(nextContent)
    setState(
      {
        sheets: state.sheets.map((sheet) =>
          sheet.id === id ? { ...sheet, content: nextContent, title, updatedAt: Date.now() } : sheet,
        ),
        yamlIssues: id === state.activeSheetId ? issues : state.yamlIssues,
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
    const inboxId = systemFolder(state.folders, 'inbox')?.id
    if (folderId !== inboxId) sessionBaselines.delete(id)
    setState(
      {
        sheets: state.sheets.map((sheet) => (sheet.id === id ? { ...sheet, folderId, updatedAt: Date.now() } : sheet)),
        activeFolderId: folderId,
        tracking: folderId === inboxId ? state.tracking : clearTracking(id),
      },
      true,
    )
    if (folderId === inboxId) beginTracking(id)
  },
  requestMoveSheet(id: string, folderId: string) {
    runProtected('移动文稿', () => workspace.moveSheet(id, folderId))
  },
  classifySheet(id: string) {
    const sheet = state.sheets.find((item) => item.id === id)
    if (!sheet) return
    const destination = destinationForType(state.folders, sheetType(sheet))
    if (!destination) return
    sessionBaselines.delete(id)
    touchedThisSession.delete(id)
    createdThisSession.delete(id)
    setState({
      sheets: state.sheets.map((item) => item.id === id ? { ...item, folderId: destination.id, updatedAt: Date.now() } : item),
      tracking: clearTracking(id),
      activeFolderId: state.activeSheetId === id ? destination.id : state.activeFolderId,
    }, true)
  },
  deleteSheet(id: string) {
    const folder = systemFolder(state.folders, 'uncategorized')
    if (!folder) return
    const target = state.sheets.find((sheet) => sheet.id === id)
    if (!target) return
    const doc = splitFrontmatter(target.content)
    const content = doc.hasFence
      ? `${stringifyFrontmatter({ ...doc.attrs, status: 'trashed', updated: todayStamp() })}\n${doc.body}`
      : target.content
    const remainingTabs = state.openTabIds.filter((tab) => tab !== id)
    const next = state.sheets.find((sheet) => sheet.id === remainingTabs[remainingTabs.length - 1])
    setState({
      sheets: state.sheets.map((sheet) => sheet.id === id ? { ...sheet, content, folderId: folder.id, updatedAt: Date.now() } : sheet),
      openTabIds: remainingTabs.length ? remainingTabs : [id],
      activeSheetId: next?.id ?? id,
      tracking: clearTracking(id),
      activeFolderId: next?.folderId ?? folder.id,
    }, true)
  },
  requestDeleteSheet(id: string) {
    runProtected('删除文稿（移至 999-未分类）', () => workspace.deleteSheet(id))
  },
  requestDeleteFolder(id: string) {
    const folder = state.folders.find((item) => item.id === id)
    if (!folder) return
    if (isSystemFolder(folder)) runProtected('删除系统预设文件夹', () => workspace.deleteFolder(id))
    else workspace.deleteFolder(id)
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
  async prepareFinishWriting() {
    const ids: string[] = Array.from(createdThisSession).filter((id) => state.sheets.some((sheet) => sheet.id === id && isTrackedSheet(sheet)))
    const tracking = { ...state.tracking }
    const candidates = new Set([
      ...Object.entries(state.tracking).filter(([, record]) => record.touched).map(([id]) => id),
      ...touchedThisSession,
    ])
    for (const id of candidates) {
      const sheet = state.sheets.find((item) => item.id === id)
      if (!sheet || !isTrackedSheet(sheet)) continue
      const record = tracking[id] ?? { touched: true, pendingClassification: false }
      const baseline = record.baselineFingerprint ?? await sessionBaselines.get(id)
      if (!baseline) continue
      const current = await fingerprintSheet(sheet)
      if (current === baseline) {
        if (record.pendingClassification) tracking[id] = { touched: false, pendingClassification: true }
        else delete tracking[id]
        sessionBaselines.delete(id)
        touchedThisSession.delete(id)
      } else {
        if (!ids.includes(id)) ids.push(id)
      }
    }
    setState({ tracking, finishWritingIds: ids }, true)
  },
  finishWriting(selectedIds: string[]) {
    selectedIds.forEach((id) => workspace.classifySheet(id))
    const selected = new Set(selectedIds)
    const tracking = { ...state.tracking }
    state.finishWritingIds.forEach((id) => {
      if (selected.has(id)) return
      tracking[id] = { touched: false, pendingClassification: true }
      sessionBaselines.delete(id)
      touchedThisSession.delete(id)
      createdThisSession.delete(id)
    })
    setState({ tracking, finishWritingIds: [] }, true)
  },
  closeFinishWriting() {
    workspace.finishWriting([])
  },
  classifyPending(selectedIds: string[]) {
    selectedIds.forEach((id) => workspace.classifySheet(id))
    setState({ startupStep: 'continue' })
  },
  openContinued(selectedIds: string[]) {
    const sheets = selectedIds.map((id) => state.sheets.find((sheet) => sheet.id === id)).filter((sheet): sheet is Sheet => Boolean(sheet))
    sheets.forEach((sheet) => beginTracking(sheet.id))
    const first = sheets[0]
    setState({
      openTabIds: sheets.length ? Array.from(new Set([...selectedIds, ...state.openTabIds])) : state.openTabIds,
      activeSheetId: first?.id ?? state.activeSheetId,
      activeFolderId: first?.folderId ?? state.activeFolderId,
      view: 'write',
      chromeMode: 'edit',
      startupStep: null,
    })
  },
  closeStartup() {
    setState({ startupStep: null })
  },
  setSuperPassword(password: string) {
    const config = { superPassword: password }
    setState({ config })
    void saveConfig(config).catch(() => toast('配置文件保存失败'))
  },
  submitPassword(password: string): boolean {
    if (!protectedAction) return false
    if (!state.config.superPassword) {
      if (!password.trim()) return false
      workspace.setSuperPassword(password)
    } else if (password !== state.config.superPassword) {
      toast('超级密码不正确')
      return false
    }
    const action = protectedAction
    protectedAction = null
    setState({ passwordGateLabel: '' })
    action.run()
    return true
  },
  closePasswordGate() {
    protectedAction = null
    setState({ passwordGateLabel: '' })
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
    if (blockLeave(next)) return
    workspace.selectSheet(next)
    setState({ chromeMode: 'select' })
  },
  openAtLine(sheetId: string, line: number) {
    const sheet = state.sheets.find((item) => item.id === sheetId)
    if (!sheet) return
    beginTracking(sheetId)
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
    if (blockLeave(sheetId)) return
    beginTracking(sheetId)
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
  async hydrate() {
    try {
    const [snapshot, config] = await Promise.all([loadWorkspace(), loadConfig()])
    const migrated = ensureSystemFolders(snapshot.folders, snapshot.sheets, snapshot.disabledSystemFolderKeys)
    const sheets = migrated.sheets.map((sheet) => {
      const doc = splitFrontmatter(sheet.content)
      if (doc.hasFence) return sheet
      const stamped = buildTemplateContent(templateById('spark')!)
      const base = splitFrontmatter(stamped)
      base.attrs.title = sheet.title
      base.attrs.needs_migration = true
      base.attrs.tags = ['migrated']
      return {
        ...sheet,
        content: `${stringifyFrontmatter(base.attrs)}\n${doc.body || sheet.content}`,
      }
    })
    const active = sheets.find((sheet) => sheet.id === snapshot.activeSheetId) ?? sheets[0]
    const issues = active ? validateDoc(splitFrontmatter(active.content).attrs, splitFrontmatter(active.content).body) : []
    const pending = Object.values(snapshot.tracking).some((record) => record.pendingClassification)
    const inboxId = systemFolder(migrated.folders, 'inbox')?.id
    const continueCandidates = sheets.some((sheet) => sheet.folderId === inboxId && sheetType(sheet) !== 'spark')
    setState({
      folders: migrated.folders,
      sheets,
      activeFolderId: snapshot.activeFolderId,
      activeSheetId: snapshot.activeSheetId,
      openTabIds: snapshot.openTabIds,
      theme: snapshot.theme,
      tracking: snapshot.tracking,
      disabledSystemFolderKeys: snapshot.disabledSystemFolderKeys,
      saveState: 'saved',
      yamlIssues: issues,
      hydrated: true,
      config,
      startupStep: pending ? 'classify' : continueCandidates ? 'continue' : null,
    }, true)
    if (active) beginTracking(active.id)
    } catch {
      setState({ hydrated: true })
    }
  },
  exportBackup() {
    downloadBackup({
      folders: state.folders,
      sheets: state.sheets,
      activeFolderId: state.activeFolderId,
      activeSheetId: state.activeSheetId,
      openTabIds: state.openTabIds,
      theme: state.theme,
      tracking: state.tracking,
      disabledSystemFolderKeys: state.disabledSystemFolderKeys,
    })
    toast('已导出备份')
  },
  persistImmediately() {
    void saveWorkspace(currentSnapshot(), true)
  },
  async importBackup(file: File) {
    const snapshot = await importBackupFile(file)
    setState(
      {
        folders: snapshot.folders,
        sheets: snapshot.sheets,
        activeFolderId: snapshot.activeFolderId,
        activeSheetId: snapshot.activeSheetId,
        openTabIds: snapshot.openTabIds,
        theme: snapshot.theme,
        tracking: snapshot.tracking,
        disabledSystemFolderKeys: snapshot.disabledSystemFolderKeys,
        chromeMode: 'edit',
        caretBySheet: {},
      },
      true,
    )
    toast('已导入备份，层级与双链保持不变')
  },
}

export function useWorkspace() {
  return useSyncExternalStore(workspace.subscribe, workspace.get, workspace.get)
}
