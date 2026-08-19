import type { ChromeMode, Folder, ManageItem, RenameTarget, SearchResult, ViewMode, WorkspaceSnapshot } from '../../types'
import type { DocType, TemplateId, ValidationIssue } from '../templates'
import type { FolioConfig } from '../config-storage'
import type { YamlValue } from '../frontmatter'

export type PickerMode = 'folder' | 'quick'
export type StartupStep = 'classify' | 'continue' | null
export type ProtectedAction = { label: string; run: () => void }

export type WorkspaceState = WorkspaceSnapshot & {
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

  // 新增检索相关
  searchOpen: boolean
  searchQuery: string
  searchResults: SearchResult[]
}

// 来自 ../templates 的 DocType，避免 types.ts 反向依赖单文件

export type Listener = () => void

// core 对外暴露的基础设施契约
export interface Core {
  get(): WorkspaceState
  set(patch: Partial<WorkspaceState> | ((prev: WorkspaceState) => WorkspaceState), persist?: boolean): void
  emit(): void
  persistSoon(): void
  currentSnapshot(): WorkspaceSnapshot
  toast(message: string): void
  subscribe(listener: Listener): () => void
}

// tracking 对外暴露的契约
export interface Tracking {
  beginTracking(id: string): void
  markTouched(id: string): void
  clearTracking(id: string): Record<string, SheetTrackingRecord>
  sessionBaselines: Map<string, Promise<string>>
  createdThisSession: Set<string>
  touchedThisSession: Set<string>
}

export interface SheetTrackingRecord {
  baselineFingerprint?: string
  touched: boolean
  pendingClassification: boolean
}

export type { Folder, ManageItem }

// workspace 对外暴露的全部方法签名（API 形状的权威来源，拆分前后必须逐字一致）
export interface WorkspaceActions {
  subscribe(listener: Listener): () => void
  get(): WorkspaceState
  selectFolder(id: string): void
  selectSheet(id: string): void
  openSheetByTitle(title: string): void
  openWiki(ref: string): void
  closeTab(id: string): void
  createFolder(parentId?: string | null): string
  requestCreateFolder(parentId?: string | null): void
  renameFolder(id: string, name: string): void
  deleteFolder(id: string): void
  renameSheet(id: string, title: string): void
  requestRenameSheet(id: string, title: string): void
  requestNewSheet(folderId?: string): void
  requestQuickSheet(): void
  selectTemplateType(type: DocType): void
  clearTemplateType(): void
  closeTemplatePicker(): void
  openYamlEditor(): void
  closeYamlEditor(): void
  applyFrontmatter(id: string, attrs: Record<string, YamlValue>): void
  createSheetFromTemplate(templateId: TemplateId, folderId?: string): void
  createSheet(folderId?: string): void
  updateSheetContent(id: string, content: string): void
  toggleStar(id: string): void
  moveSheet(id: string, folderId: string): void
  requestMoveSheet(id: string, folderId: string): void
  classifySheet(id: string): void
  deleteSheet(id: string): void
  requestDeleteSheet(id: string): void
  requestDeleteFolder(id: string): void
  setView(view: ViewMode): void
  setQuery(query: string): void
  toggleSidebar(): void
  toggleFocus(): void
  cycleTheme(): void
  prepareFinishWriting(): Promise<void>
  finishWriting(selectedIds: string[]): void
  closeFinishWriting(): void
  classifyPending(selectedIds: string[]): void
  openContinued(selectedIds: string[]): void
  closeStartup(): void
  setSuperPassword(password: string): void
  submitPassword(password: string): boolean
  closePasswordGate(): void
  setCaret(sheetId: string, pos: number, line: number, col: number): void
  setChromeMode(mode: ChromeMode, message?: string): void
  cycleChromeMode(): void
  nextTab(): void
  openAtLine(sheetId: string, line: number): void
  requestRename(target: RenameTarget): void
  clearRename(): void
  moveManage(delta: number): void
  currentManageItem(): ManageItem | null
  toggleManageExpand(): void
  collapseManage(): void
  expandManage(): void
  confirmManage(): void
  hydrate(): Promise<void>
  exportBackup(): void
  persistImmediately(): void
  importBackup(file: File): Promise<void>
}

// 组装层暴露给各 slice 的共享上下文。
// get/set 是唯一 state 访问通道（实时读取，不捕获旧值）；
// actions 在组装完成后填充，供跨族调用延迟解析（避免循环 import）。
export interface SliceContext {
  get(): WorkspaceState
  set(patch: Partial<WorkspaceState> | ((prev: WorkspaceState) => WorkspaceState), persist?: boolean): void
  toast(message: string): void
  blockLeave(nextId?: string): boolean
  beginTracking(id: string): void
  markTouched(id: string): void
  clearTracking(id: string): Record<string, SheetTrackingRecord>
  sessionBaselines: Map<string, Promise<string>>
  createdThisSession: Set<string>
  touchedThisSession: Set<string>
  runProtected(label: string, run: () => void): void
  protectedAction: ProtectedActionRef
  currentSnapshot(): WorkspaceSnapshot
  actions: WorkspaceActions
}

export interface ProtectedActionRef {
  current: ProtectedAction | null
}

export type SliceFactory = (ctx: SliceContext) => Partial<WorkspaceActions>