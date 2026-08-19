import { describe, expect, it } from 'vitest'
import { normalizeSnapshot, parseBackup, seedSnapshot, toWorkspaceFile, WORKSPACE_VERSION, folderPath } from '../../src/lib/workspace-io'
import type { Folder } from '../../src/types'

describe('normalizeSnapshot', () => {
  it('无 folders 或 sheets 时返回 null', () => {
    expect(normalizeSnapshot(null)).toBeNull()
    expect(normalizeSnapshot({})).toBeNull()
    expect(normalizeSnapshot({ folders: [], sheets: [] })).toBeNull()
  })

  it('修正缺失字段的默认值', () => {
    const snapshot = normalizeSnapshot({
      folders: [{ id: 'f1', name: '' }],
      sheets: [{ id: 's1', folderId: 'f1', title: '', content: '' }],
    })
    expect(snapshot?.folders[0].name).toBe('未命名文件夹')
    expect(snapshot?.sheets[0].title).toBe('未命名文稿')
    expect(snapshot?.sheets[0].starred).toBe(false)
  })

  it('引用不存在文件夹的文稿回退到第一个文件夹', () => {
    const snapshot = normalizeSnapshot({
      folders: [{ id: 'f1', name: '收集箱' }],
      sheets: [{ id: 's1', folderId: 'ghost' }],
    })
    expect(snapshot?.sheets[0].folderId).toBe('f1')
  })

  it('activeSheetId 不存在时回退到第一份文稿', () => {
    const snapshot = normalizeSnapshot({
      folders: [{ id: 'f1', name: '收集箱' }],
      sheets: [{ id: 's1', folderId: 'f1' }],
      activeSheetId: 'ghost',
    })
    expect(snapshot?.activeSheetId).toBe('s1')
  })

  it('openTabIds 过滤无效 id 并兜底 activeSheetId', () => {
    const snapshot = normalizeSnapshot({
      folders: [{ id: 'f1', name: '收集箱' }],
      sheets: [{ id: 's1', folderId: 'f1' }, { id: 's2', folderId: 'f1' }],
      activeSheetId: 's2',
      openTabIds: ['s2', 'ghost'],
    })
    expect(snapshot?.openTabIds).toEqual(['s2'])
  })

  it('theme 只接受 light/dark，其余归为 system', () => {
    const snap = normalizeSnapshot({
      folders: [{ id: 'f1', name: '收集箱' }],
      sheets: [{ id: 's1', folderId: 'f1' }],
      theme: 'sepia',
    })
    expect(snap?.theme).toBe('system')
  })

  it('tracking 默认空对象', () => {
    const snap = normalizeSnapshot({
      folders: [{ id: 'f1', name: '收集箱' }],
      sheets: [{ id: 's1', folderId: 'f1' }],
    })
    expect(snap?.tracking).toEqual({})
  })
})

describe('seedSnapshot', () => {
  it('生成包含文件夹与文稿的初始快照', () => {
    const seed = seedSnapshot()
    expect(seed.folders.length).toBeGreaterThan(0)
    expect(seed.sheets.length).toBeGreaterThan(0)
    expect(seed.tracking).toEqual({})
    expect(seed.openTabIds).toContain(seed.activeSheetId)
  })
})

describe('toWorkspaceFile', () => {
  it('附加版本号', () => {
    const seed = seedSnapshot()
    const file = toWorkspaceFile(seed)
    expect(file.version).toBe(WORKSPACE_VERSION)
  })
})

describe('parseBackup', () => {
  it('解析合法备份', () => {
    const seed = seedSnapshot()
    const raw = JSON.stringify(toWorkspaceFile(seed))
    const parsed = parseBackup(raw)
    expect(parsed?.sheets).toHaveLength(seed.sheets.length)
  })

  it('非法 JSON 返回 null', () => {
    expect(parseBackup('{not json')).toBeNull()
  })
})

describe('folderPath', () => {
  const folders: Folder[] = [
    { id: 'a', name: 'A', order: 0, parentId: null },
    { id: 'b', name: 'B', order: 0, parentId: 'a' },
    { id: 'c', name: 'C', order: 0, parentId: 'b' },
  ]
  it('返回从根到自身的路径', () => {
    const path = folderPath(folders, 'c')
    expect(path.map((f) => f.id)).toEqual(['a', 'b', 'c'])
  })
  it('不存在的 id 返回空数组', () => {
    expect(folderPath(folders, 'ghost')).toEqual([])
  })
  it('循环引用不会死循环', () => {
    const cyclic: Folder[] = [
      { id: 'x', name: 'X', order: 0, parentId: 'y' },
      { id: 'y', name: 'Y', order: 0, parentId: 'x' },
    ]
    expect(() => folderPath(cyclic, 'x')).not.toThrow()
  })
})