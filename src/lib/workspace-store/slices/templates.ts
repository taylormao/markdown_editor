import type { Sheet } from '../../../types'
import type { SliceContext, WorkspaceActions } from '../types'
import { asString, splitFrontmatter, todayStamp } from '../../frontmatter'
import { uid } from '../../id'
import { titleFromContent } from '../../document-tree'
import { buildTemplateContent, templateById, validateDoc, type DocType, type TemplateId } from '../../templates'
import { systemFolder } from '../../workspace-folders'

// templates slice：模板选择器状态与从模板创建文稿。
// 跨族调用（selectSheet）走 ctx.actions 延迟解析；pending 归类标记写入 ctx.createdThisSession。
export function createTemplatesSlice(ctx: SliceContext) {
  const get = ctx.get
  const set = ctx.set

  return {
    requestNewSheet(folderId = get().activeFolderId) {
      const folder = get().folders.find((item) => item.id === folderId)
      if (folder?.systemKey && !folder.docType && !['inbox', 'uncategorized'].includes(folder.systemKey)) {
        ctx.toast('请在具体 type 子目录中创建文稿')
        return
      }
      set({
        templatePickerFor: folderId,
        templatePickerMode: 'folder',
        templatePickerType: (folder?.docType as DocType | undefined) ?? null,
        sidebarOpen: true,
        focusMode: false,
      })
    },
    requestQuickSheet() {
      set({
        templatePickerFor: systemFolder(get().folders, 'inbox')?.id ?? get().activeFolderId,
        templatePickerMode: 'quick',
        templatePickerType: null,
        sidebarOpen: true,
        focusMode: false,
      })
    },
    selectTemplateType(type: DocType) {
      set({ templatePickerType: type })
    },
    clearTemplateType() {
      set({ templatePickerType: null })
    },
    closeTemplatePicker() {
      set({ templatePickerFor: null, templatePickerType: null })
    },
    createSheetFromTemplate(templateId: TemplateId, folderId = get().templatePickerFor ?? get().activeFolderId) {
      const def = templateById(templateId)
      if (!def) return
      if (def.id === 'daily') {
        const date = todayStamp()
        const existing = get().sheets.find((sheet) => {
          const attrs = splitFrontmatter(sheet.content).attrs
          return asString(attrs.template) === 'daily' && asString(attrs.date) === date
        })
        if (existing) {
          set({ templatePickerFor: null })
          ctx.actions.selectSheet(existing.id)
          ctx.toast('今天的晚间笔记已存在，已打开')
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
      const inboxId = systemFolder(get().folders, 'inbox')?.id
      const pending = (get().templatePickerMode === 'quick' || folderId === inboxId) && def.type !== 'spark'
      if (pending) ctx.createdThisSession.add(sheet.id)
      set(
        {
          sheets: [sheet, ...get().sheets],
          activeFolderId: folderId,
          activeSheetId: sheet.id,
          openTabIds: [sheet.id, ...get().openTabIds.filter((tab) => tab !== sheet.id)],
          view: 'write',
          focusMode: false,
          chromeMode: 'edit',
          templatePickerFor: null,
          templatePickerType: null,
          tracking: pending
            ? { ...get().tracking, [sheet.id]: { touched: false, pendingClassification: true } }
            : get().tracking,
          yamlIssues: issues,
        },
        true,
      )
    },
    createSheet(folderId = get().activeFolderId) {
      ctx.actions.requestNewSheet(folderId)
    },
  } satisfies Partial<WorkspaceActions>
}