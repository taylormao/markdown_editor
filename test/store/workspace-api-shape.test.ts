import { describe, expect, it, vi } from 'vitest'

// API 形状测试：workspace 对象的方法名集合是拆分重构的硬契约。
// 拆分 workspace-store.ts 前后，此集合必须逐字一致（不多不少）。
// 用 vi.mock 屏蔽 storage/config-storage，仅验证对象形状，不触发副作用。

vi.mock('../../src/lib/storage', () => ({
  loadWorkspace: vi.fn(async () => ({ folders: [], sheets: [], activeFolderId: '', activeSheetId: '', openTabIds: [], theme: 'system', tracking: {}, disabledSystemFolderKeys: [] })),
  saveWorkspace: vi.fn(async () => {}),
  exportBackup: vi.fn(),
  importBackupFile: vi.fn(),
}))

vi.mock('../../src/lib/config-storage', () => ({
  loadConfig: vi.fn(async () => ({ superPassword: '' })),
  saveConfig: vi.fn(async () => {}),
}))

const EXPECTED_METHODS = [
  'subscribe',
  'get',
  'selectFolder',
  'selectSheet',
  'openSheetByTitle',
  'openWiki',
  'closeTab',
  'createFolder',
  'requestCreateFolder',
  'renameFolder',
  'deleteFolder',
  'renameSheet',
  'requestRenameSheet',
  'requestNewSheet',
  'requestQuickSheet',
  'selectTemplateType',
  'clearTemplateType',
  'closeTemplatePicker',
  'openYamlEditor',
  'closeYamlEditor',
  'applyFrontmatter',
  'createSheetFromTemplate',
  'createSheet',
  'updateSheetContent',
  'toggleStar',
  'moveSheet',
  'requestMoveSheet',
  'classifySheet',
  'deleteSheet',
  'requestDeleteSheet',
  'requestDeleteFolder',
  'setView',
  'setQuery',
  'toggleSidebar',
  'toggleFocus',
  'cycleTheme',
  'prepareFinishWriting',
  'finishWriting',
  'closeFinishWriting',
  'classifyPending',
  'openContinued',
  'closeStartup',
  'setSuperPassword',
  'submitPassword',
  'closePasswordGate',
  'setCaret',
  'setChromeMode',
  'cycleChromeMode',
  'nextTab',
  'openAtLine',
  'requestRename',
  'clearRename',
  'moveManage',
  'currentManageItem',
  'toggleManageExpand',
  'collapseManage',
  'expandManage',
  'confirmManage',
  'hydrate',
  'exportBackup',
  'persistImmediately',
  'importBackup',
] as const

describe('workspace API 形状', () => {
  it('workspace 对象的方法名集合与期望完全一致（不多不少）', async () => {
    vi.resetModules()
    const mod = await import('../../src/lib/workspace-store')
    const actual = new Set(Object.keys(mod.workspace))
    const expected = new Set(EXPECTED_METHODS)
    const missing = [...expected].filter((name) => !actual.has(name))
    const extra = [...actual].filter((name) => !expected.has(name))
    expect(missing, `缺少方法: ${missing.join(', ')}`).toEqual([])
    expect(extra, `多余方法: ${extra.join(', ')}`).toEqual([])
  })

  it('useWorkspace 是可导出的函数', async () => {
    vi.resetModules()
    const mod = await import('../../src/lib/workspace-store')
    expect(typeof mod.useWorkspace).toBe('function')
  })

  it('workspace 提供 subscribe 与 get（store 契约）', async () => {
    vi.resetModules()
    const mod = await import('../../src/lib/workspace-store')
    expect(typeof mod.workspace.subscribe).toBe('function')
    expect(typeof mod.workspace.get).toBe('function')
  })
})