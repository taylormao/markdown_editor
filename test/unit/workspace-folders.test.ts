import { describe, expect, it } from 'vitest'
import type { Folder, Sheet } from '../../src/types'
import { destinationForType, ensureSystemFolders, isSystemFolder, systemFolder } from '../../src/lib/workspace-folders'

const inbox: Folder = { id: 'inbox', name: '收集箱', order: 0, parentId: null, systemKey: 'inbox' }
const daily: Folder = { id: 'daily-f', name: '210-每日', order: 0, parentId: null, systemKey: 'daily', docType: 'daily' }

function makeSheet(id: string, folderId: string, type = 'daily'): Sheet {
  return {
    id,
    folderId,
    title: `文稿${id}`,
    content: `---\nid: ${id}\ntype: ${type}\n---\n\n# 标题`,
    createdAt: 1,
    updatedAt: 1,
    starred: false,
  }
}

describe('systemFolder', () => {
  it('按 systemKey 查找文件夹', () => {
    expect(systemFolder([inbox, daily], 'inbox')?.id).toBe('inbox')
    expect(systemFolder([inbox, daily], 'daily')?.id).toBe('daily-f')
    expect(systemFolder([inbox, daily], 'archives')).toBeUndefined()
  })
})

describe('destinationForType', () => {
  it('按 docType 返回归类目标文件夹', () => {
    expect(destinationForType([inbox, daily], 'daily')?.id).toBe('daily-f')
    expect(destinationForType([inbox, daily], 'project')).toBeUndefined()
  })
})

describe('isSystemFolder', () => {
  it('有 systemKey 的是系统文件夹', () => {
    expect(isSystemFolder(inbox)).toBe(true)
    expect(isSystemFolder({ ...inbox, systemKey: undefined })).toBe(false)
  })
})

describe('ensureSystemFolders', () => {
  it('补齐缺失的系统文件夹并设置名称与顺序', () => {
    const { folders } = ensureSystemFolders([inbox], [makeSheet('s1', 'inbox')])
    const byKey = new Map(folders.map((f) => [f.systemKey, f]))
    for (const key of ['inbox', 'templates', 'projects', 'project', 'meeting', 'areas', 'daily', 'review', 'resources', 'video', 'literature', 'clip', 'publish', 'archives', 'uncategorized']) {
      expect(byKey.get(key), `缺少系统文件夹 ${key}`).toBeTruthy()
    }
  })

  it('把旧的"文稿"文件夹迁移为 999-未分类', () => {
    const oldDrafts: Folder = { id: 'old', name: '文稿', order: 1, parentId: null }
    const { folders } = ensureSystemFolders([inbox, oldDrafts], [makeSheet('s1', 'old')])
    const migrated = folders.find((f) => f.id === 'old')
    expect(migrated?.systemKey).toBe('uncategorized')
    expect(migrated?.name).toBe('999-未分类')
  })

  it('引用不存在文件夹的文稿回退到兜底文件夹', () => {
    const { folders, sheets } = ensureSystemFolders([inbox], [makeSheet('s1', 'ghost-folder')])
    // 兜底顺序：uncategorized ?? inbox
    const uncat = folders.find((f) => f.systemKey === 'uncategorized')
    expect(sheets[0].folderId).toBe(uncat?.id)
  })

  it('disabledKeys 中禁用的系统文件夹不会被补齐', () => {
    const { folders } = ensureSystemFolders([inbox], [makeSheet('s1', 'inbox')], ['archives'])
    expect(folders.some((f) => f.systemKey === 'archives')).toBe(false)
  })

  it('父文件夹引用指向系统文件夹', () => {
    const { folders } = ensureSystemFolders([inbox], [makeSheet('s1', 'inbox')])
    const project = folders.find((f) => f.systemKey === 'project')
    const projects = folders.find((f) => f.systemKey === 'projects')
    expect(project?.parentId).toBe(projects?.id)
  })
})