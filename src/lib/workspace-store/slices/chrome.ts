import type { ChromeMode, RenameTarget, ViewMode } from '../../../types'
import type { SliceContext, WorkspaceActions, WorkspaceState } from '../types'
import { lineToPos, manageItemsIn } from '../helpers'
import { saveConfig } from '../../config-storage'

// chrome slice：视图 / UI / 密码门 / YAML 编辑器 / 重命名请求 / 光标与模式。
// 全部经 ctx 访问 state（get/set 实时读取），跨族调用走 ctx.actions 延迟解析。
// 返回类型不标注 Partial：satisfies 只做契约校验，保持方法具体类型，
// 组装层 spread 后方法仍为非 optional（避免下游调用报 possibly undefined）。

export function createChromeSlice(ctx: SliceContext) {
  const get = ctx.get
  const set = ctx.set
  const toast = ctx.toast

  return {
    setView(view: ViewMode) {
      set({ view, focusMode: false })
    },
    setQuery(query: string) {
      set({ query })
    },
    toggleSidebar() {
      set({ sidebarOpen: !get().sidebarOpen, focusMode: false })
    },
    toggleFocus() {
      const next = !get().focusMode
      set({ focusMode: next, sidebarOpen: next ? false : get().sidebarOpen })
    },
    cycleTheme() {
      const order = ['system', 'light', 'dark'] as const
      const next = order[(order.indexOf(get().theme) + 1) % order.length]
      set({ theme: next }, true)
    },
    setCaret(sheetId: string, pos: number, line: number, col: number) {
      set({
        caretBySheet: { ...get().caretBySheet, [sheetId]: pos },
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
        const s = get()
        const items = manageItemsIn(s.folders, s.sheets, s.activeFolderId, s.collapsedFolderIds, s.expandedSheetIds)
        const current = items.findIndex((item) => item.kind === 'sheet' && item.id === s.activeSheetId)
        const folder = items.findIndex((item) => item.kind === 'folder' && item.id === s.activeFolderId)
        patch.manageIndex = current >= 0 ? current : Math.max(0, folder)
      }
      set(patch)
      if (message) toast(message)
    },
    cycleChromeMode() {
      if (get().chromeMode === 'edit') ctx.actions.setChromeMode('select', '进入标签选择模式')
      else if (get().chromeMode === 'select') ctx.actions.setChromeMode('manage', '进入管理模式')
      else ctx.actions.setChromeMode('edit', '进入编辑模式')
    },
    nextTab() {
      const tabs = get().openTabIds.filter((id) => get().sheets.some((sheet) => sheet.id === id))
      if (!tabs.length) return
      const index = Math.max(0, tabs.indexOf(get().activeSheetId))
      const next = tabs[(index + 1) % tabs.length]
      if (ctx.blockLeave(next)) return
      ctx.actions.selectSheet(next)
      set({ chromeMode: 'select' })
    },
    openAtLine(sheetId: string, line: number) {
      const sheet = get().sheets.find((item) => item.id === sheetId)
      if (!sheet) return
      ctx.beginTracking(sheetId)
      const pos = lineToPos(sheet.content, line)
      set({
        activeSheetId: sheetId,
        activeFolderId: sheet.folderId,
        openTabIds: get().openTabIds.includes(sheetId) ? get().openTabIds : [...get().openTabIds, sheetId],
        caretBySheet: { ...get().caretBySheet, [sheetId]: pos },
        view: 'write',
        chromeMode: 'edit',
        focusMode: false,
      })
      toast('进入编辑模式')
    },
    requestRename(target: RenameTarget) {
      set({ renameTarget: target })
    },
    clearRename() {
      set({ renameTarget: null })
    },
    setSuperPassword(password: string) {
      const config = { superPassword: password }
      set({ config })
      void saveConfig(config).catch(() => toast('配置文件保存失败'))
    },
    submitPassword(password: string): boolean {
      if (!ctx.protectedAction.current) return false
      if (!get().config.superPassword) {
        if (!password.trim()) return false
        ctx.actions.setSuperPassword(password)
      } else if (password !== get().config.superPassword) {
        toast('超级密码不正确')
        return false
      }
      const action = ctx.protectedAction.current
      ctx.protectedAction.current = null
      set({ passwordGateLabel: '' })
      action.run()
      return true
    },
    closePasswordGate() {
      ctx.protectedAction.current = null
      set({ passwordGateLabel: '' })
    },
    openYamlEditor() {
      if (get().chromeMode !== 'edit') return
      set({ yamlEditorOpen: true })
    },
    closeYamlEditor() {
      set({ yamlEditorOpen: false })
    },
  } satisfies Partial<WorkspaceActions>
}