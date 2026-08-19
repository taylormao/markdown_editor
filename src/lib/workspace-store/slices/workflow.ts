import type { Sheet } from '../../../types'
import type { SliceContext, WorkspaceActions } from '../types'
import { splitFrontmatter, stringifyFrontmatter } from '../../frontmatter'
import { exportBackup as downloadBackup, importBackupFile, loadWorkspace, saveWorkspace } from '../../storage'
import { buildTemplateContent, templateById, validateDoc } from '../../templates'
import { fingerprintSheet } from '../../sheet-tracking'
import { loadConfig } from '../../config-storage'
import { ensureSystemFolders, systemFolder } from '../../workspace-folders'
import { isTrackedSheetIn, sheetType } from '../helpers'

// workflow slice：结束写作归类流程 + 启动引导 + 持久化/备份。
// 指纹基线经 ctx.sessionBaselines/createdThisSession/touchedThisSession 读取；
// 跨族调用（classifySheet/finishWriting）走 ctx.actions 延迟解析。
export function createWorkflowSlice(ctx: SliceContext) {
  const get = ctx.get
  const set = ctx.set

  function isTrackedSheet(sheet: Sheet): boolean {
    return isTrackedSheetIn(get().folders, sheet)
  }

  return {
    async prepareFinishWriting() {
      const ids: string[] = Array.from(ctx.createdThisSession).filter((id) => get().sheets.some((sheet) => sheet.id === id && isTrackedSheet(sheet)))
      const tracking = { ...get().tracking }
      const candidates = new Set([
        ...Object.entries(get().tracking).filter(([, record]) => record.touched).map(([id]) => id),
        ...ctx.touchedThisSession,
      ])
      for (const id of candidates) {
        const sheet = get().sheets.find((item) => item.id === id)
        if (!sheet || !isTrackedSheet(sheet)) continue
        const record = tracking[id] ?? { touched: true, pendingClassification: true }
        const baseline = record.baselineFingerprint ?? await ctx.sessionBaselines.get(id)
        if (!baseline) continue
        const current = await fingerprintSheet(sheet)
        if (current === baseline) {
          if (record.pendingClassification) tracking[id] = { touched: false, pendingClassification: true }
          else tracking[id] = { touched: false, pendingClassification: false }
          ctx.sessionBaselines.delete(id)
          ctx.touchedThisSession.delete(id)
        } else {
          if (!ids.includes(id)) ids.push(id)
        }
      }
      set({ tracking, finishWritingIds: ids }, true)
    },
    finishWriting(selectedIds: string[]) {
      selectedIds.forEach((id) => ctx.actions.classifySheet(id))
      const selected = new Set(selectedIds)
      const tracking = { ...get().tracking }
      get().finishWritingIds.forEach((id) => {
        if (selected.has(id)) return
        tracking[id] = { touched: false, pendingClassification: true }
        ctx.sessionBaselines.delete(id)
        ctx.touchedThisSession.delete(id)
        ctx.createdThisSession.delete(id)
      })
      set({ tracking, finishWritingIds: [] }, true)
    },
    closeFinishWriting() {
      ctx.actions.finishWriting([])
    },
    classifyPending(selectedIds: string[]) {
      selectedIds.forEach((id) => ctx.actions.classifySheet(id))
      set({ startupStep: 'continue' })
    },
    openContinued(selectedIds: string[]) {
      const sheets = selectedIds.map((id) => get().sheets.find((sheet) => sheet.id === id)).filter((sheet): sheet is Sheet => Boolean(sheet))
      sheets.forEach((sheet) => ctx.beginTracking(sheet.id))
      const first = sheets[0]
      set({
        openTabIds: sheets.length ? Array.from(new Set([...selectedIds, ...get().openTabIds])) : get().openTabIds,
        activeSheetId: first?.id ?? get().activeSheetId,
        activeFolderId: first?.folderId ?? get().activeFolderId,
        view: 'write',
        chromeMode: 'edit',
        startupStep: null,
      })
    },
    closeStartup() {
      set({ startupStep: null })
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
      set({
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
      if (active) ctx.beginTracking(active.id)
      } catch {
        set({ hydrated: true })
      }
    },
    exportBackup() {
      downloadBackup({
        folders: get().folders,
        sheets: get().sheets,
        activeFolderId: get().activeFolderId,
        activeSheetId: get().activeSheetId,
        openTabIds: get().openTabIds,
        theme: get().theme,
        tracking: get().tracking,
        disabledSystemFolderKeys: get().disabledSystemFolderKeys,
      })
      ctx.toast('已导出备份')
    },
    persistImmediately() {
      void saveWorkspace(ctx.currentSnapshot(), true)
    },
    async importBackup(file: File) {
      const snapshot = await importBackupFile(file)
      set(
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
      ctx.toast('已导入备份，层级与双链保持不变')
    },
  } satisfies Partial<WorkspaceActions>
}