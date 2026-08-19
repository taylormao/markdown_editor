import type { SliceContext, WorkspaceActions } from '../types'
import { splitFrontmatter, stringifyFrontmatter, todayStamp, type YamlValue } from '../../frontmatter'
import { titleFromContent } from '../../document-tree'
import { validateDoc } from '../../templates'
import { collectWikiRefs, mergeRelated, normalizeWikiRefs, resolveWikiRef } from '../../wiki-scan'
import { destinationForType, systemFolder } from '../../workspace-folders'
import { sheetType } from '../helpers'

// sheets slice：文稿内容/重命名/星标/移动/归类/软删除。
// 危险操作包装（requestXxx）走 ctx.runProtected；跨族调用走 ctx.actions 延迟解析。
export function createSheetsSlice(ctx: SliceContext) {
  const get = ctx.get
  const set = ctx.set

  return {
    renameSheet(id: string, title: string) {
      ctx.markTouched(id)
      const next = title.trim() || '未命名文稿'
      set(
        {
          sheets: get().sheets.map((sheet) => {
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
      ctx.runProtected('重命名文稿', () => ctx.actions.renameSheet(id, title))
    },
    applyFrontmatter(id: string, attrs: Record<string, YamlValue>) {
      const sheet = get().sheets.find((item) => item.id === id)
      if (!sheet) return
      const doc = splitFrontmatter(sheet.content)
      const related = mergeRelated(
        attrs.related ?? doc.attrs.related,
        collectWikiRefs(doc.body).map((ref) => resolveWikiRef(ref, get().sheets)),
      )
      const content = `${stringifyFrontmatter({ ...doc.attrs, ...attrs, related, updated: todayStamp() })}\n${doc.body}`
      ctx.actions.updateSheetContent(id, content)
      const next = validateDoc(splitFrontmatter(content).attrs, doc.body)
      if (!next.length) set({ yamlEditorOpen: false, yamlIssues: [] })
      else set({ yamlIssues: next })
    },
    updateSheetContent(id: string, content: string) {
      const current = get().sheets.find((sheet) => sheet.id === id)
      if (!current) return
      if (current.content === content) return
      ctx.markTouched(id)
      let nextContent = content
      const initialDoc = splitFrontmatter(content)
      const normalizedBody = normalizeWikiRefs(initialDoc.body, get().sheets)
      if (initialDoc.hasFence && normalizedBody !== initialDoc.body) {
        nextContent = `${stringifyFrontmatter(initialDoc.attrs)}\n${normalizedBody}`
      }
      const scanned = collectWikiRefs(splitFrontmatter(nextContent).body)
      if (scanned.length) {
        const doc0 = splitFrontmatter(content)
        if (doc0.hasFence) {
          const related = mergeRelated(
            doc0.attrs.related,
            scanned.map((ref) => resolveWikiRef(ref, get().sheets)),
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
      const blocked = get().activeSheetId !== id && issues.length > 0
      if (blocked) {
        set({ yamlIssues: issues })
        ctx.toast('当前文稿缺必填字段，先补完再离开')
        return
      }
      const title = titleFromContent(nextContent)
      set(
        {
          sheets: get().sheets.map((sheet) =>
            sheet.id === id ? { ...sheet, content: nextContent, title, updatedAt: Date.now() } : sheet,
          ),
          yamlIssues: id === get().activeSheetId ? issues : get().yamlIssues,
        },
        true,
      )
    },
    toggleStar(id: string) {
      set(
        {
          sheets: get().sheets.map((sheet) => (sheet.id === id ? { ...sheet, starred: !sheet.starred } : sheet)),
        },
        true,
      )
    },
    moveSheet(id: string, folderId: string) {
      const inboxId = systemFolder(get().folders, 'inbox')?.id
      if (folderId !== inboxId) {
        ctx.sessionBaselines.delete(id)
        ctx.touchedThisSession.delete(id)
        ctx.createdThisSession.delete(id)
      }
      set(
        {
          sheets: get().sheets.map((sheet) => (sheet.id === id ? { ...sheet, folderId, updatedAt: Date.now() } : sheet)),
          activeFolderId: folderId,
          // 庇清：移回收集箱恢复待分类；移出收集箱标记已分类（均保留记录，不保留旧基线）
          tracking: {
            ...get().tracking,
            [id]: { touched: false, pendingClassification: folderId === inboxId },
          },
        },
        true,
      )
      if (folderId === inboxId) ctx.beginTracking(id)
    },
    requestMoveSheet(id: string, folderId: string) {
      ctx.runProtected('移动文稿', () => ctx.actions.moveSheet(id, folderId))
    },
    classifySheet(id: string) {
      const sheet = get().sheets.find((item) => item.id === id)
      if (!sheet) return
      const destination = destinationForType(get().folders, sheetType(sheet))
      if (!destination) return
      ctx.sessionBaselines.delete(id)
      ctx.touchedThisSession.delete(id)
      ctx.createdThisSession.delete(id)
      set({
        sheets: get().sheets.map((item) => item.id === id ? { ...item, folderId: destination.id, updatedAt: Date.now() } : item),
        // 庇清：已分类文件保留记录，pendingClassification 置 false（不再待分类）
        tracking: {
          ...get().tracking,
          [id]: { touched: false, pendingClassification: false },
        },
        activeFolderId: get().activeSheetId === id ? destination.id : get().activeFolderId,
      }, true)
    },
    deleteSheet(id: string) {
      const folder = systemFolder(get().folders, 'uncategorized')
      if (!folder) return
      const target = get().sheets.find((sheet) => sheet.id === id)
      if (!target) return
      const doc = splitFrontmatter(target.content)
      const content = doc.hasFence
        ? `${stringifyFrontmatter({ ...doc.attrs, status: 'trashed', updated: todayStamp() })}\n${doc.body}`
        : target.content
      const remainingTabs = get().openTabIds.filter((tab) => tab !== id)
      const next = get().sheets.find((sheet) => sheet.id === remainingTabs[remainingTabs.length - 1])
      set({
        sheets: get().sheets.map((sheet) => sheet.id === id ? { ...sheet, content, folderId: folder.id, updatedAt: Date.now() } : sheet),
        openTabIds: remainingTabs.length ? remainingTabs : [id],
        activeSheetId: next?.id ?? id,
        tracking: ctx.clearTracking(id),
        activeFolderId: next?.folderId ?? folder.id,
      }, true)
    },
    requestDeleteSheet(id: string) {
      ctx.runProtected('删除文稿（移至 999-未分类）', () => ctx.actions.deleteSheet(id))
    },
  } satisfies Partial<WorkspaceActions>
}