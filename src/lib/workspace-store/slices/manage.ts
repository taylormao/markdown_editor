import type { ManageItem } from '../../../types'
import type { SliceContext, WorkspaceActions, WorkspaceState } from '../types'
import { lineToPos, manageItemsIn } from '../helpers'

// manage slice：管理模式下的光标移动 / 展开折叠 / 确认选择。
// 全部经 ctx 访问 state（get/set 实时读取），跨族调用走 ctx.actions 延迟解析。

export function createManageSlice(ctx: SliceContext) {
  const get = ctx.get
  const set = ctx.set

  const manageItems = () =>
    manageItemsIn(get().folders, get().sheets, get().activeFolderId, get().collapsedFolderIds, get().expandedSheetIds)

  return {
    moveManage(delta: number) {
      const items = manageItems()
      if (!items.length) return
      const next = (get().manageIndex + delta + items.length) % items.length
      const item = items[next]
      const patch: Partial<WorkspaceState> = { manageIndex: next, chromeMode: 'manage' }
      if (item.kind === 'folder') patch.activeFolderId = item.id
      if (item.kind === 'sheet') {
        patch.activeSheetId = item.id
        patch.activeFolderId = get().sheets.find((sheet) => sheet.id === item.id)?.folderId ?? get().activeFolderId
      }
      if (item.kind === 'outline') {
        patch.activeSheetId = item.sheetId
        patch.activeFolderId = get().sheets.find((sheet) => sheet.id === item.sheetId)?.folderId ?? get().activeFolderId
      }
      set(patch)
    },
    currentManageItem(): ManageItem | null {
      return manageItems()[get().manageIndex] ?? null
    },
    toggleManageExpand() {
      const item = manageItems()[get().manageIndex]
      if (!item) return
      if (item.kind === 'folder') {
        const collapsed = get().collapsedFolderIds.includes(item.id)
          ? get().collapsedFolderIds.filter((id) => id !== item.id)
          : [...get().collapsedFolderIds, item.id]
        set({ collapsedFolderIds: collapsed, activeFolderId: item.id })
      }
      if (item.kind === 'sheet') {
        const expanded = get().expandedSheetIds.includes(item.id)
          ? get().expandedSheetIds.filter((id) => id !== item.id)
          : [...get().expandedSheetIds, item.id]
        set({ expandedSheetIds: expanded })
      }
    },
    collapseManage() {
      const item = manageItems()[get().manageIndex]
      if (!item) return
      if (item.kind === 'folder' && !get().collapsedFolderIds.includes(item.id)) {
        set({ collapsedFolderIds: [...get().collapsedFolderIds, item.id], activeFolderId: item.id })
        return
      }
      if (item.kind === 'sheet' && get().expandedSheetIds.includes(item.id)) {
        set({ expandedSheetIds: get().expandedSheetIds.filter((id) => id !== item.id) })
        return
      }
      if (item.kind === 'sheet' || item.kind === 'outline') {
        const folderId = item.kind === 'sheet'
          ? get().sheets.find((sheet) => sheet.id === item.id)?.folderId
          : get().sheets.find((sheet) => sheet.id === item.sheetId)?.folderId
        if (!folderId) return
        const items = manageItems()
        const folderIndex = items.findIndex((entry) => entry.kind === 'folder' && entry.id === folderId)
        set({
          collapsedFolderIds: get().collapsedFolderIds.includes(folderId) ? get().collapsedFolderIds : [...get().collapsedFolderIds, folderId],
          activeFolderId: folderId,
          manageIndex: Math.max(0, folderIndex),
        })
      }
    },
    expandManage() {
      const item = manageItems()[get().manageIndex]
      if (!item) return
      if (item.kind === 'folder') {
        set({
          collapsedFolderIds: get().collapsedFolderIds.filter((id) => id !== item.id),
          activeFolderId: item.id,
        })
      }
      if (item.kind === 'sheet' && !get().expandedSheetIds.includes(item.id)) {
        set({ expandedSheetIds: [...get().expandedSheetIds, item.id] })
      }
    },
    confirmManage() {
      const item = manageItems()[get().manageIndex]
      if (!item) return
      if (item.kind === 'folder') {
        ctx.actions.selectFolder(item.id)
        return
      }
      const sheetId = item.kind === 'sheet' ? item.id : item.sheetId
      const sheet = get().sheets.find((entry) => entry.id === sheetId)
      if (!sheet) return
      if (ctx.blockLeave(sheetId)) return
      ctx.beginTracking(sheetId)
      const pos = item.kind === 'outline' ? lineToPos(sheet.content, item.line) : get().caretBySheet[sheetId] ?? 0
      set({
        activeSheetId: sheetId,
        activeFolderId: sheet.folderId,
        openTabIds: get().openTabIds.includes(sheetId) ? get().openTabIds : [...get().openTabIds, sheetId],
        caretBySheet: { ...get().caretBySheet, [sheetId]: pos },
        view: 'write',
        chromeMode: 'edit',
        focusMode: false,
      })
      ctx.toast('进入编辑模式')
    },
  } satisfies Partial<WorkspaceActions>
}