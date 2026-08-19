import { useSyncExternalStore } from 'react'
import type { ValidationIssue } from '../templates'
import { computeIssues } from './helpers'
import { core } from './core'
import { createTracking } from './tracking'
import { createChromeSlice } from './slices/chrome'
import { createFoldersSlice } from './slices/folders'
import { createManageSlice } from './slices/manage'
import { createNavigationSlice } from './slices/navigation'
import { createTemplatesSlice } from './slices/templates'
import { createSheetsSlice } from './slices/sheets'
import { createWorkflowSlice } from './slices/workflow'
import type { Listener, ProtectedActionRef, SliceContext, WorkspaceActions } from './types'

// state 访问统一走 core（实时读取，不捕获旧值）
const getState = core.get
const setState = core.set
const toast = core.toast
const currentSnapshot = core.currentSnapshot
const subscribe = core.subscribe

// 指纹追踪基础设施
const tracking = createTracking(core)
const beginTracking = tracking.beginTracking
const markTouched = tracking.markTouched
const clearTracking = tracking.clearTracking
const sessionBaselines = tracking.sessionBaselines
const createdThisSession = tracking.createdThisSession
const touchedThisSession = tracking.touchedThisSession

// 密码门受保护操作（组装层持有，chrome slice 通过 ctx.protectedAction 访问）
const protectedAction: ProtectedActionRef = { current: null }

function currentIssues(): ValidationIssue[] {
  return computeIssues(getState().sheets, getState().activeSheetId)
}

function blockLeave(nextId?: string): boolean {
  if (nextId && nextId === getState().activeSheetId) return false
  const issues = currentIssues()
  if (!issues.length) return false
  setState({ yamlIssues: issues })
  toast('当前文稿缺必填字段，不能切走')
  return true
}

function runProtected(label: string, run: () => void) {
  protectedAction.current = { label, run }
  setState({ passwordGateLabel: label })
}

// 组装上下文：slices 共享的依赖注入通道。
// actions 在 workspace 组装完成后填充，跨族调用延迟到调用时解析（避免循环依赖）。
const ctx: SliceContext = {
  get: core.get,
  set: core.set,
  toast: core.toast,
  blockLeave,
  beginTracking,
  markTouched,
  clearTracking,
  sessionBaselines,
  createdThisSession,
  touchedThisSession,
  runProtected,
  protectedAction,
  currentSnapshot,
  actions: {} as WorkspaceActions,
}

export const workspace = {
  subscribe(listener: Listener) {
    return subscribe(listener)
  },
  get() {
    return getState()
  },
  ...createChromeSlice(ctx),
  ...createFoldersSlice(ctx),
  ...createManageSlice(ctx),
  ...createNavigationSlice(ctx),
  ...createTemplatesSlice(ctx),
  ...createSheetsSlice(ctx),
  ...createWorkflowSlice(ctx),
} satisfies WorkspaceActions

// 组装完成：回填 actions，供跨族调用延迟解析（此时 workspace 对象已完整）
ctx.actions = workspace

export function useWorkspace() {
  return useSyncExternalStore(workspace.subscribe, workspace.get, workspace.get)
}
