import type { Sheet } from '../../../types'
import type { SliceContext, WorkspaceActions } from '../types'
import { asString, splitFrontmatter } from '../../frontmatter'

// navigation slice：文件夹/文稿选择、标签打开与双链跳转。
// 全部经 ctx 访问 state（get/set 实时读取），跨族调用走 ctx.actions 延迟解析。

function selectSheetState(ctx: SliceContext, sheet: Sheet) {
  const get = ctx.get
  const set = ctx.set
  ctx.beginTracking(sheet.id)
  set({
    activeSheetId: sheet.id,
    activeFolderId: sheet.folderId,
    openTabIds: get().openTabIds.includes(sheet.id) ? get().openTabIds : [...get().openTabIds, sheet.id],
    view: 'write',
    focusMode: false,
    chromeMode: 'edit',
  })
}

export function createNavigationSlice(ctx: SliceContext) {
  const get = ctx.get
  const set = ctx.set

  return {
    selectFolder(id: string) {
      const first = get().sheets.find((sheet) => sheet.folderId === id)
      if (first && ctx.blockLeave(first.id)) return
      if (first) ctx.beginTracking(first.id)
      set({
        activeFolderId: id,
        activeSheetId: first?.id ?? get().activeSheetId,
        openTabIds: first ? Array.from(new Set([...get().openTabIds, first.id])) : get().openTabIds,
        sidebarOpen: true,
        focusMode: false,
      })
    },
    selectSheet(id: string) {
      if (ctx.blockLeave(id)) return
      const sheet = get().sheets.find((item) => item.id === id)
      if (!sheet) return
      ctx.beginTracking(id)
      set({
        activeSheetId: id,
        activeFolderId: sheet.folderId,
        openTabIds: get().openTabIds.includes(id) ? get().openTabIds : [...get().openTabIds, id],
        focusMode: false,
        chromeMode: get().chromeMode === 'manage' ? 'manage' : get().chromeMode,
      })
    },
    openSheetByTitle(title: string) {
      ctx.actions.openWiki(title)
    },
    openWiki(ref: string) {
      const needle = ref.trim()
      const byId = get().sheets.find((item) => item.id === needle || asString(splitFrontmatter(item.content).attrs.id) === needle)
      const byTitle = get().sheets.find((item) => item.title.trim().toLowerCase() === needle.toLowerCase())
      const sheet = byId ?? byTitle
      if (!sheet) return
      if (ctx.blockLeave(sheet.id)) return
      selectSheetState(ctx, sheet)
    },
    closeTab(id: string) {
      if (id === get().activeSheetId && ctx.blockLeave()) return
      if (get().openTabIds.length === 1) {
        void ctx.actions.prepareFinishWriting()
        return
      }
      const remaining = get().openTabIds.filter((tab) => tab !== id)
      const nextId = get().activeSheetId === id ? remaining[remaining.length - 1] : get().activeSheetId
      const next = get().sheets.find((sheet) => sheet.id === nextId)
      set({
        openTabIds: remaining,
        activeSheetId: next?.id ?? get().activeSheetId,
        activeFolderId: next?.folderId ?? get().activeFolderId,
      })
    },
  } satisfies Partial<WorkspaceActions>
}