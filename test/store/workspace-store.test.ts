import { beforeEach, describe, expect, it, vi } from 'vitest'

// 屏蔽 storage 与 config 的网络请求，hydrate 用确定性快照
const fixtureSnapshot = {
  folders: [
    { id: 'inbox', name: '收集箱', order: 0, parentId: null, systemKey: 'inbox' },
    { id: 'tpl', name: '000-模板', order: 1, parentId: null, systemKey: 'templates' },
    { id: 'proj-root', name: '100-项目', order: 2, parentId: null, systemKey: 'projects' },
    { id: 'proj', name: '110-项目', order: 0, parentId: 'proj-root', systemKey: 'project', docType: 'project' },
    { id: 'mtg', name: '120-会议', order: 1, parentId: 'proj-root', systemKey: 'meeting', docType: 'meeting' },
    { id: 'areas', name: '200-领域', order: 3, parentId: null, systemKey: 'areas' },
    { id: 'daily', name: '210-每日', order: 0, parentId: 'areas', systemKey: 'daily', docType: 'daily' },
    { id: 'review', name: '220-复盘', order: 1, parentId: 'areas', systemKey: 'review', docType: 'review' },
    { id: 'res', name: '300-资源', order: 4, parentId: null, systemKey: 'resources' },
    { id: 'video', name: '310-视频', order: 0, parentId: 'res', systemKey: 'video', docType: 'video' },
    { id: 'lit', name: '320-读书', order: 1, parentId: 'res', systemKey: 'literature', docType: 'literature' },
    { id: 'clip', name: '330-收藏', order: 2, parentId: 'res', systemKey: 'clip', docType: 'clip' },
    { id: 'publish', name: '340-publish', order: 3, parentId: 'res', systemKey: 'publish', docType: 'tutorial' },
    { id: 'arch', name: '400-归档', order: 5, parentId: null, systemKey: 'archives' },
    { id: 'uncat', name: '999-未分类', order: 6, parentId: null, systemKey: 'uncategorized' },
  ],
  sheets: [
    {
      id: 'welcome',
      folderId: 'uncat',
      title: '把思想写成作品',
      content: '---\nid: welcome\ntype: spark\n---\n\n# 把思想写成作品',
      createdAt: 1,
      updatedAt: 2,
      starred: true,
    },
  ],
  activeFolderId: 'inbox',
  activeSheetId: 'welcome',
  openTabIds: ['welcome'],
  theme: 'system',
  tracking: {},
  disabledSystemFolderKeys: [],
} as const

vi.mock('../../src/lib/storage', () => ({
  loadWorkspace: vi.fn(async () => JSON.parse(JSON.stringify(fixtureSnapshot))),
  saveWorkspace: vi.fn(async () => {}),
  exportBackup: vi.fn(),
  importBackupFile: vi.fn(),
}))

vi.mock('../../src/lib/config-storage', () => ({
  loadConfig: vi.fn(async () => ({ superPassword: '' })),
  saveConfig: vi.fn(async () => {}),
}))

type StoreModule = typeof import('../../src/lib/workspace-store')

async function freshStore(): Promise<StoreModule> {
  vi.resetModules()
  const mod = await import('../../src/lib/workspace-store')
  return mod
}

function inboxId(store: StoreModule): string {
  return store.workspace.get().folders.find((f) => f.systemKey === 'inbox')!.id
}

function dailyId(store: StoreModule): string {
  return store.workspace.get().folders.find((f) => f.systemKey === 'daily')!.id
}

beforeEach(() => {
  localStorage.clear()
})

describe('庇清机制：新建文稿', () => {
  it('快速新建（quick 模式）的非 spark 文稿默认待分类 pendingClassification=true', async () => {
    const store = await freshStore()
    await store.workspace.hydrate()
    store.workspace.requestQuickSheet()
    const before = store.workspace.get().sheets.length
    store.workspace.createSheetFromTemplate('daily')
    const state = store.workspace.get()
    const created = state.sheets[0]
    expect(state.sheets).toHaveLength(before + 1)
    expect(created.folderId).toBe(inboxId(store))
    expect(state.tracking[created.id]).toEqual({ touched: false, pendingClassification: true })
  })

  it('目录内新建到收集箱（folder 模式 inbox）同样待分类', async () => {
    const store = await freshStore()
    await store.workspace.hydrate()
    store.workspace.requestNewSheet(inboxId(store))
    store.workspace.createSheetFromTemplate('daily', inboxId(store))
    const state = store.workspace.get()
    const created = state.sheets[0]
    expect(created.folderId).toBe(inboxId(store))
    expect(state.tracking[created.id].pendingClassification).toBe(true)
  })

  it('目录内新建到正式 type 目录不建追踪记录（已分类）', async () => {
    const store = await freshStore()
    await store.workspace.hydrate()
    store.workspace.requestNewSheet(dailyId(store))
    store.workspace.createSheetFromTemplate('daily', dailyId(store))
    const state = store.workspace.get()
    const created = state.sheets[0]
    expect(created.folderId).toBe(dailyId(store))
    expect(state.tracking[created.id]).toBeUndefined()
  })

  it('spark 新建不参与待分类（收集箱内 spark 常驻）', async () => {
    const store = await freshStore()
    await store.workspace.hydrate()
    store.workspace.requestQuickSheet()
    store.workspace.createSheetFromTemplate('spark')
    const state = store.workspace.get()
    const created = state.sheets[0]
    expect(created.folderId).toBe(inboxId(store))
    expect(state.tracking[created.id]).toBeUndefined()
  })

  it('daily 当天已存在时复用已有文稿而不新建', async () => {
    const store = await freshStore()
    await store.workspace.hydrate()
    store.workspace.requestQuickSheet()
    store.workspace.createSheetFromTemplate('daily')
    const count = store.workspace.get().sheets.length
    store.workspace.createSheetFromTemplate('daily')
    expect(store.workspace.get().sheets).toHaveLength(count)
  })
})

describe('庇清机制：自动归类', () => {
  it('classifySheet 按 type 移动到目标目录并保留记录、置 pendingClassification=false', async () => {
    const store = await freshStore()
    await store.workspace.hydrate()
    store.workspace.requestQuickSheet()
    store.workspace.createSheetFromTemplate('daily')
    const created = store.workspace.get().sheets[0]
    store.workspace.classifySheet(created.id)
    const state = store.workspace.get()
    const moved = state.sheets.find((s) => s.id === created.id)!
    expect(moved.folderId).toBe(dailyId(store))
    expect(state.tracking[created.id]).toEqual({ touched: false, pendingClassification: false })
  })

  it('归类到对应 type 目录（meeting 归到会议目录）', async () => {
    const store = await freshStore()
    await store.workspace.hydrate()
    store.workspace.requestQuickSheet()
    store.workspace.createSheetFromTemplate('meeting')
    const created = store.workspace.get().sheets[0]
    store.workspace.classifySheet(created.id)
    const moved = store.workspace.get().sheets.find((s) => s.id === created.id)!
    expect(moved.folderId).toBe(store.workspace.get().folders.find((f) => f.systemKey === 'meeting')!.id)
  })

  it('归类不存在的文稿是安全的空操作', async () => {
    const store = await freshStore()
    await store.workspace.hydrate()
    store.workspace.classifySheet('ghost-id')
    expect(store.workspace.get().sheets).toHaveLength(1)
  })
})

describe('庇清机制：手动移动', () => {
  it('移回收集箱置 pendingClassification=true 并保留记录', async () => {
    const store = await freshStore()
    await store.workspace.hydrate()
    // 先建一份并归类
    store.workspace.requestQuickSheet()
    store.workspace.createSheetFromTemplate('daily')
    const created = store.workspace.get().sheets[0]
    store.workspace.classifySheet(created.id)
    // 移回收集箱
    store.workspace.moveSheet(created.id, inboxId(store))
    const state = store.workspace.get()
    const moved = state.sheets.find((s) => s.id === created.id)!
    expect(moved.folderId).toBe(inboxId(store))
    expect(state.tracking[created.id]).toEqual({ touched: false, pendingClassification: true })
  })

  it('移出收集箱置 pendingClassification=false 且保留记录', async () => {
    const store = await freshStore()
    await store.workspace.hydrate()
    store.workspace.requestQuickSheet()
    store.workspace.createSheetFromTemplate('daily')
    const created = store.workspace.get().sheets[0]
    store.workspace.moveSheet(created.id, dailyId(store))
    const state = store.workspace.get()
    const moved = state.sheets.find((s) => s.id === created.id)!
    expect(moved.folderId).toBe(dailyId(store))
    expect(state.tracking[created.id]).toEqual({ touched: false, pendingClassification: false })
  })

  it('requestMoveSheet 需要超级密码门禁', async () => {
    const store = await freshStore()
    await store.workspace.hydrate()
    store.workspace.requestQuickSheet()
    store.workspace.createSheetFromTemplate('daily')
    const created = store.workspace.get().sheets[0]
    store.workspace.requestMoveSheet(created.id, dailyId(store))
    const state = store.workspace.get()
    expect(state.passwordGateLabel).toBe('移动文稿')
    expect(state.sheets.find((s) => s.id === created.id)!.folderId).toBe(inboxId(store)) // 尚未移动
    // 设置密码并提交后执行
    store.workspace.setSuperPassword('secret')
    store.workspace.submitPassword('secret')
    expect(store.workspace.get().sheets.find((s) => s.id === created.id)!.folderId).toBe(dailyId(store))
  })

  it('密码错误时门禁不执行', async () => {
    const store = await freshStore()
    await store.workspace.hydrate()
    store.workspace.setSuperPassword('secret')
    store.workspace.requestQuickSheet()
    store.workspace.createSheetFromTemplate('daily')
    const created = store.workspace.get().sheets[0]
    store.workspace.requestMoveSheet(created.id, dailyId(store))
    store.workspace.submitPassword('wrong')
    expect(store.workspace.get().sheets.find((s) => s.id === created.id)!.folderId).toBe(inboxId(store))
  })
})

describe('庇清机制：指纹追踪', () => {
  it('编辑收集箱文稿会设置 touched 与 baselineFingerprint', async () => {
    const store = await freshStore()
    await store.workspace.hydrate()
    store.workspace.requestQuickSheet()
    store.workspace.createSheetFromTemplate('daily')
    const created = store.workspace.get().sheets[0]
    store.workspace.updateSheetContent(created.id, `${store.workspace.get().sheets[0].content}\n新增内容`)
    // markTouched 异步写入指纹
    await new Promise((resolve) => setTimeout(resolve, 50))
    const record = store.workspace.get().tracking[created.id]
    expect(record.touched).toBe(true)
    expect(record.baselineFingerprint).toMatch(/^[0-9a-f]{64}$/)
    expect(record.pendingClassification).toBe(true)
  })

  it('编辑后 prepareFinishWriting 把文稿列入归类清单', async () => {
    const store = await freshStore()
    await store.workspace.hydrate()
    store.workspace.requestQuickSheet()
    store.workspace.createSheetFromTemplate('daily')
    const created = store.workspace.get().sheets[0]
    store.workspace.updateSheetContent(created.id, `${store.workspace.get().sheets[0].content}\n编辑内容`)
    await new Promise((resolve) => setTimeout(resolve, 50))
    await store.workspace.prepareFinishWriting()
    expect(store.workspace.get().finishWritingIds).toContain(created.id)
  })

  it('修改完全撤销后（本 session 新建）仍进入清单但记录保留', async () => {
    const store = await freshStore()
    await store.workspace.hydrate()
    store.workspace.requestQuickSheet()
    store.workspace.createSheetFromTemplate('daily')
    const created = store.workspace.get().sheets[0]
    const original = store.workspace.get().sheets[0].content
    // 编辑再完全还原
    store.workspace.updateSheetContent(created.id, `${original}\n临时内容`)
    await new Promise((resolve) => setTimeout(resolve, 50))
    store.workspace.updateSheetContent(created.id, original)
    await new Promise((resolve) => setTimeout(resolve, 50))
    await store.workspace.prepareFinishWriting()
    const state = store.workspace.get()
    // createdThisSession 中的新建文稿需决定归类去留，即使内容还原也进入清单
    expect(state.finishWritingIds).toContain(created.id)
    // 记录保留且待分类状态不变
    expect(state.tracking[created.id]).toEqual({ touched: false, pendingClassification: true })
  })

  it('finishWriting 归类所选文稿，未选文稿保持待分类', async () => {
    const store = await freshStore()
    await store.workspace.hydrate()
    store.workspace.requestQuickSheet()
    store.workspace.createSheetFromTemplate('daily')
    store.workspace.createSheetFromTemplate('meeting')
    const state0 = store.workspace.get()
    const [meeting, daily] = [state0.sheets.find((s) => s.content.includes('meeting'))!, state0.sheets.find((s) => s.content.includes('daily'))!]
    store.workspace.updateSheetContent(daily.id, `${daily.content}\n编辑`)
    store.workspace.updateSheetContent(meeting.id, `${meeting.content}\n编辑`)
    await new Promise((resolve) => setTimeout(resolve, 50))
    await store.workspace.prepareFinishWriting()
    store.workspace.finishWriting([daily.id])
    const state = store.workspace.get()
    // daily 已归类
    expect(state.sheets.find((s) => s.id === daily.id)!.folderId).toBe(dailyId(store))
    expect(state.tracking[daily.id]).toEqual({ touched: false, pendingClassification: false })
    // meeting 留在收集箱仍待分类
    expect(state.sheets.find((s) => s.id === meeting.id)!.folderId).toBe(inboxId(store))
    expect(state.tracking[meeting.id]).toEqual({ touched: false, pendingClassification: true })
  })
})

describe('启动清单', () => {
  it('存在待归类记录时启动进入 classify 步骤', async () => {
    const store = await freshStore()
    const mod = await import('../../src/lib/storage')
    vi.mocked(mod.loadWorkspace).mockResolvedValue({
      ...fixtureSnapshot,
      tracking: { 'some-id': { touched: true, pendingClassification: true } },
    } as never)
    await store.workspace.hydrate()
    expect(store.workspace.get().startupStep).toBe('classify')
  })

  it('无待归类但有收集箱候选时启动进入 continue 步骤', async () => {
    const store = await freshStore()
    const mod = await import('../../src/lib/storage')
    vi.mocked(mod.loadWorkspace).mockResolvedValue({
      ...fixtureSnapshot,
      sheets: [
        ...fixtureSnapshot.sheets,
        {
          id: 'inbox-draft',
          folderId: 'inbox',
          title: '待继续',
          content: '---\nid: inbox-draft\ntype: daily\n---\n\n# 待继续',
          createdAt: 1,
          updatedAt: 2,
          starred: false,
        },
      ],
      tracking: {},
    } as never)
    await store.workspace.hydrate()
    expect(store.workspace.get().startupStep).toBe('continue')
  })

  it('无待归类且无收集箱候选时启动不弹窗', async () => {
    const store = await freshStore()
    const mod = await import('../../src/lib/storage')
    vi.mocked(mod.loadWorkspace).mockResolvedValue(JSON.parse(JSON.stringify(fixtureSnapshot)) as never)
    await store.workspace.hydrate()
    expect(store.workspace.get().startupStep).toBeNull()
  })

  it('classifyPending 归类所选并进入 continue 步骤', async () => {
    const store = await freshStore()
    await store.workspace.hydrate()
    store.workspace.requestQuickSheet()
    store.workspace.createSheetFromTemplate('daily')
    const created = store.workspace.get().sheets[0]
    store.workspace.classifyPending([created.id])
    expect(store.workspace.get().startupStep).toBe('continue')
    expect(store.workspace.get().tracking[created.id].pendingClassification).toBe(false)
  })
})

describe('超级密码', () => {
  it('首次设置密码并提交成功', async () => {
    const store = await freshStore()
    await store.workspace.hydrate()
    expect(store.workspace.get().config.superPassword).toBe('')
    store.workspace.requestQuickSheet()
    store.workspace.createSheetFromTemplate('daily')
    const created = store.workspace.get().sheets[0]
    store.workspace.requestMoveSheet(created.id, dailyId(store))
    expect(store.workspace.get().passwordGateLabel).toBe('移动文稿')
    store.workspace.submitPassword('new-secret') // 首次设置
    expect(store.workspace.get().config.superPassword).toBe('new-secret')
    expect(store.workspace.get().sheets.find((s) => s.id === created.id)!.folderId).toBe(dailyId(store))
  })

  it('关闭密码门禁不执行操作', async () => {
    const store = await freshStore()
    await store.workspace.hydrate()
    store.workspace.setSuperPassword('secret')
    store.workspace.requestQuickSheet()
    store.workspace.createSheetFromTemplate('daily')
    const created = store.workspace.get().sheets[0]
    store.workspace.requestMoveSheet(created.id, dailyId(store))
    store.workspace.closePasswordGate()
    expect(store.workspace.get().passwordGateLabel).toBe('')
    expect(store.workspace.get().sheets.find((s) => s.id === created.id)!.folderId).toBe(inboxId(store))
  })
})

describe('软删除', () => {
  it('deleteSheet 移到 999-未分类、标记 trashed 并清除追踪记录', async () => {
    const store = await freshStore()
    await store.workspace.hydrate()
    store.workspace.requestQuickSheet()
    store.workspace.createSheetFromTemplate('daily')
    const created = store.workspace.get().sheets[0]
    store.workspace.deleteSheet(created.id)
    const state = store.workspace.get()
    const deleted = state.sheets.find((s) => s.id === created.id)!
    expect(deleted.folderId).toBe(state.folders.find((f) => f.systemKey === 'uncategorized')!.id)
    expect(deleted.content).toContain('trashed')
    expect(state.tracking[created.id]).toBeUndefined() // 删除应清除记录
  })

  it('requestDeleteSheet 需要超级密码', async () => {
    const store = await freshStore()
    await store.workspace.hydrate()
    store.workspace.setSuperPassword('secret')
    store.workspace.requestQuickSheet()
    store.workspace.createSheetFromTemplate('daily')
    const created = store.workspace.get().sheets[0]
    store.workspace.requestDeleteSheet(created.id)
    expect(store.workspace.get().passwordGateLabel).toBe('删除文稿（移至 999-未分类）')
    expect(store.workspace.get().sheets.find((s) => s.id === created.id)!.folderId).toBe(inboxId(store))
  })
})

describe('视图与状态', () => {
  it('切换视图与焦点模式', async () => {
    const store = await freshStore()
    await store.workspace.hydrate()
    store.workspace.setView('preview')
    expect(store.workspace.get().view).toBe('preview')
    store.workspace.toggleFocus()
    expect(store.workspace.get().focusMode).toBe(true)
    expect(store.workspace.get().sidebarOpen).toBe(false)
  })

  it('切换主题循环 system → light → dark → system', async () => {
    const store = await freshStore()
    await store.workspace.hydrate()
    store.workspace.cycleTheme()
    expect(store.workspace.get().theme).toBe('light')
    store.workspace.cycleTheme()
    expect(store.workspace.get().theme).toBe('dark')
    store.workspace.cycleTheme()
    expect(store.workspace.get().theme).toBe('system')
  })

  it('星标切换', async () => {
    const store = await freshStore()
    await store.workspace.hydrate()
    const sheet = store.workspace.get().sheets[0]
    store.workspace.toggleStar(sheet.id)
    expect(store.workspace.get().sheets[0].starred).toBe(!sheet.starred)
  })

  it('搜索查询更新 query 状态', async () => {
    const store = await freshStore()
    await store.workspace.hydrate()
    store.workspace.setQuery('关键词')
    expect(store.workspace.get().query).toBe('关键词')
  })
})

describe('文件夹操作', () => {
  it('创建与删除文件夹', async () => {
    const store = await freshStore()
    await store.workspace.hydrate()
    const before = store.workspace.get().folders.length
    store.workspace.createFolder()
    const state = store.workspace.get()
    expect(state.folders).toHaveLength(before + 1)
    const created = state.folders[state.folders.length - 1]
    store.workspace.deleteFolder(created.id)
    expect(store.workspace.get().folders).toHaveLength(before)
  })

  it('重命名文件夹', async () => {
    const store = await freshStore()
    await store.workspace.hydrate()
    const folder = store.workspace.get().folders.find((f) => f.systemKey === 'inbox')!
    store.workspace.renameFolder(folder.id, '新收集箱名')
    expect(store.workspace.get().folders.find((f) => f.id === folder.id)!.name).toBe('新收集箱名')
  })
})