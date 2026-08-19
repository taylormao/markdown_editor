import type { Folder } from '../../../types'
import type { SliceContext, WorkspaceActions } from '../types'
import { uid } from '../../id'
import { isSystemFolder } from '../../workspace-folders'

// folders slice：目录增删改与受保护操作。
// 全部经 ctx 访问 state（get/set 实时读取），跨族调用走 ctx.actions 延迟解析。

export function createFoldersSlice(ctx: SliceContext) {
  const get = ctx.get
  const set = ctx.set

  return {
    createFolder(parentId: string | null = null) {
      const folder: Folder = { id: uid(), name: '新文件夹', order: get().folders.length, parentId }
      set({ folders: [...get().folders, folder], activeFolderId: folder.id }, true)
      return folder.id
    },
    requestCreateFolder(parentId: string | null = null) {
      ctx.runProtected('创建子文件夹', () => ctx.actions.createFolder(parentId))
    },
    renameFolder(id: string, name: string) {
      set(
        {
          folders: get().folders.map((folder) => (folder.id === id ? { ...folder, name } : folder)),
        },
        true,
      )
    },
    deleteFolder(id: string) {
      if (get().folders.length <= 1) return
      const doomed = new Set<string>()
      const walk = (fid: string) => {
        doomed.add(fid)
        get().folders.filter((folder) => folder.parentId === fid).forEach((child) => walk(child.id))
      }
      walk(id)
      const disabledSystemFolderKeys = Array.from(new Set([
        ...get().disabledSystemFolderKeys,
        ...get().folders.filter((folder) => doomed.has(folder.id)).map((folder) => folder.systemKey).filter((key): key is NonNullable<typeof key> => Boolean(key)),
      ]))
      const leftover = get().folders.filter((folder) => !doomed.has(folder.id))
      if (!leftover.length) return
      const fallback = leftover[0]
      const sheets = get().sheets.map((sheet) => (doomed.has(sheet.folderId) ? { ...sheet, folderId: fallback.id } : sheet))
      set(
        {
          folders: leftover,
          sheets,
          activeFolderId: doomed.has(get().activeFolderId) ? fallback.id : get().activeFolderId,
          disabledSystemFolderKeys,
        },
        true,
      )
    },
    requestDeleteFolder(id: string) {
      const folder = get().folders.find((item) => item.id === id)
      if (!folder) return
      if (isSystemFolder(folder)) ctx.runProtected('删除系统预设文件夹', () => ctx.actions.deleteFolder(id))
      else ctx.actions.deleteFolder(id)
    },
  } satisfies Partial<WorkspaceActions>
}