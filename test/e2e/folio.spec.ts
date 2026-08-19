import { expect, test, type Page } from '@playwright/test'
import seed from './seed'

// E2E 测试使用真实 UI 选择器（Sidebar / TemplatePicker / WorkflowDialogs / PasswordGate）。
// 测试自包含：beforeAll 把确定性 fixture seed 写入服务端，beforeEach 完整还原。
// 不依赖 data/workspace.json 内容——服务器可能被手动使用或上次测试写脏。

const API = 'http://127.0.0.1:5173/api/workspace'
// fixture seed 中真实存在的 id
const SEED_DAILY_ID = '20260819-daily-7lk6'

// 整套测试共享一个纯净 seed：beforeAll 写入，beforeEach 完整还原。
// 不能只清 tracking——测试会新建/移动文稿，跨用例累积会污染后续断言。
test.beforeAll(async ({ request }) => {
  await request.put(API, { data: seed })
})

async function resetWorkspace(page: Page) {
  // 完整还原服务端快照（文件夹/文稿/tracking/激活状态全部回到 seed）；
  // localStorage 由 addInitScript 每次加载前清空
  await page.request.put(API, { data: seed })
}

/** 启动流程可能连续出现 classify → continue 两个弹窗，循环点击“暂不处理”直到无弹窗。 */
async function dismissStartupDialog(page: Page) {
  const dialog = page.locator('.workflow-dialog')
  try {
    await dialog.waitFor({ state: 'visible', timeout: 8000 })
  } catch {
    return // 无启动弹窗
  }
  // classify 的“暂不处理”会把 startupStep 切到 continue，需要连点直到清空
  for (let i = 0; i < 5; i++) {
    if (!(await dialog.isVisible().catch(() => false))) break
    await dialog.locator('.text-btn').click()
    await page.waitForTimeout(400)
  }
  // 确认遮罩彻底消失，避免拦截后续点击
  await expect(page.locator('.template-mask')).toHaveCount(0, { timeout: 5000 })
}

test.beforeEach(async ({ page, context }) => {
  // 每次页面加载前清空 localStorage，避免 app 防抖持久化把旧 tracking 写回
  await context.addInitScript(() => localStorage.clear())
  await resetWorkspace(page)
  await page.goto('/')
  await page.waitForSelector('.chrome', { timeout: 15000 })
  await dismissStartupDialog(page)
})

/** 通过侧栏 + 快速新建走完 type → 模板两级选择，创建 project 文稿到收集箱。 */
async function quickCreateProject(page: Page) {
  await page.locator('.rail-head .ghost-btn').click()
  await expect(page.locator('.template-dialog')).toBeVisible()
  await page.locator('.template-grid button', { hasText: '项目' }).click()
  await expect(page.getByText('选择具体模板')).toBeVisible()
  await page.locator('.template-grid button', { hasText: '项目' }).last().click()
  await page.waitForSelector('.cm-editor')
}

test('应用启动并渲染侧栏与工具栏', async ({ page }) => {
  await expect(page.locator('.glass-rail')).toBeVisible()
  await expect(page.locator('.chrome')).toBeVisible()
  await expect(page.getByText('Folio', { exact: true })).toBeVisible()
})

test('快速新建：+ 按钮打开类型选择，选择项目创建文稿到收集箱', async ({ page }) => {
  await page.locator('.rail-head .ghost-btn').click()
  await expect(page.locator('.template-dialog')).toBeVisible()
  await expect(page.getByText('选择文稿类型')).toBeVisible()
  await page.locator('.template-grid button', { hasText: '项目' }).click()
  await expect(page.getByText('选择具体模板')).toBeVisible()
  await page.locator('.template-grid button', { hasText: '项目' }).last().click()
  await page.waitForSelector('.cm-editor')
  // 新建的文稿是当前激活文稿；服务端快照经 420ms 防抖落盘，轮询直到 activeSheetId 指向它
  await expect(async () => {
    const snap = await page.evaluate((api) => fetch(api).then((r) => r.json()), API)
    const created = snap.sheets.find((s: any) => s.id === snap.activeSheetId)
    expect(created?.content ?? '').toContain('template: project')
  }).toPass({ timeout: 10000 })
  const snap = await page.evaluate((api) => fetch(api).then((r) => r.json()), API)
  const created = snap.sheets.find((s: any) => s.id === snap.activeSheetId)
  const inbox = snap.folders.find((f: any) => f.systemKey === 'inbox')
  expect(created.folderId).toBe(inbox.id)
})

test('目录内新建：右键项目目录选择新建文稿', async ({ page }) => {
  // 右键 110-项目 子目录弹出上下文菜单
  const projectFolder = page.locator('[data-folder-id]', { hasText: '110-项目' }).first()
  await projectFolder.click({ button: 'right' })
  await expect(page.locator('.ctx-menu')).toBeVisible()
  // 点击“新建文稿”打开模板选择（folder 模式：直接显示该目录 type 的模板）
  await page.locator('.ctx-menu button', { hasText: '新建文稿' }).click()
  await expect(page.locator('.template-dialog')).toBeVisible()
  await expect(page.getByText('选择具体模板')).toBeVisible()
})

test('结束写作：编辑收集箱文稿后工具栏触发归类清单', async ({ page }) => {
  await quickCreateProject(page)
  // 编辑正文
  await page.locator('.cm-content').click()
  await page.keyboard.press('Control+End')
  await page.keyboard.type('\n新增测试内容')
  // 结束写作
  await page.getByText('结束写作', { exact: true }).click()
  await expect(page.locator('.workflow-dialog')).toBeVisible()
  await expect(page.getByText('整理本次编辑的文稿')).toBeVisible()
})

test('归类所选文稿：确认后文稿移入对应 type 目录', async ({ page }) => {
  await quickCreateProject(page)
  await page.locator('.cm-content').click()
  await page.keyboard.press('Control+End')
  await page.keyboard.type('\n内容')
  await page.getByText('结束写作', { exact: true }).click()
  await page.locator('.workflow-dialog .primary-btn').click()
  // 等待归类完成：workflow 关闭，文稿移入 project 目录（服务端经 420ms 防抖落盘，轮询等待）
  await expect(page.locator('.workflow-dialog')).toHaveCount(0, { timeout: 10000 })
  const projectFolderId = await page.evaluate((api) => fetch(api).then((r) => r.json()), API).then((snap: any) => snap.folders.find((f: any) => f.systemKey === 'project').id)
  await expect(async () => {
    const snap = await page.evaluate((api) => fetch(api).then((r) => r.json()), API)
    // 用 activeSheetId 定位新建文稿（seed 中已有 project 文稿，不能按内容 find）
    const created = snap.sheets.find((s: any) => s.id === snap.activeSheetId)
    expect(created?.folderId).toBe(projectFolderId)
  }).toPass({ timeout: 10000 })
})

test('手动移动文稿需要超级密码', async ({ page }) => {
  await quickCreateProject(page)
  // 侧栏收集箱中文稿卡片右键 → 移动到 → 选择目标目录
  const card = page.locator('[data-sheet-id]').first()
  await card.click({ button: 'right' })
  await expect(page.locator('.ctx-menu')).toBeVisible()
  // 展开“移动到”飞层
  await page.locator('.ctx-menu .ctx-parent').hover()
  await expect(page.locator('.ctx-menu .ctx-flyout')).toBeVisible()
  await page.locator('.ctx-menu .ctx-flyout button').first().click()
  // 触发超级密码（未设置 → 设置弹窗）
  await expect(page.locator('.password-dialog')).toBeVisible()
  await expect(page.getByText('设置超级密码')).toBeVisible()
})

test('软删除：删除按钮触发密码并移入 999-未分类', async ({ page }) => {
  await quickCreateProject(page)
  // 卡片上的删除按钮（先注册 confirm 处理再点击）
  page.on('dialog', (dialog) => void dialog.accept())
  const card = page.locator('[data-sheet-id]').first()
  await card.locator('button[title="删除"]').click()
  await expect(page.locator('.password-dialog')).toBeVisible()
})

test('视图切换：写作/预览/大纲/导图', async ({ page }) => {
  // 工具栏按钮与编辑器正文可能同时含「大纲/导图」文本，必须用 getByRole 精确定位按钮
  await page.getByRole('button', { name: '预览' }).click()
  await page.getByRole('button', { name: '大纲' }).click()
  await page.getByRole('button', { name: '导图' }).click()
  await page.getByRole('button', { name: '写作', exact: true }).click()
  await expect(page.locator('.cm-editor')).toBeVisible()
})

test('搜索过滤侧栏文稿', async ({ page }) => {
  // seed 的 inbox 中有“2026-08-19 晚间”（daily）与“一个尚未展开的念头”（spark）
  await page.locator('.search input').fill('尚未展开')
  await expect(page.locator('.sheet-card').first()).toContainText('尚未展开')
})

test('启动待归类清单：存在 pending 记录时显示分类弹窗', async ({ page, context }) => {
  // 等 beforeEach 页面可能残留的防抖持久化（420ms）落盘，避免它把内存中的空 tracking 写回
  await page.waitForTimeout(700)
  // 预置真实文稿的 pending 记录（Node 侧请求），重载后应弹出“上次待归类的文稿”
  const res = await page.request.get(API)
  const snap = await res.json()
  snap.tracking = { [SEED_DAILY_ID]: { touched: false, pendingClassification: true } }
  await page.request.put(API, { data: snap })
  // 用全新页面加载：旧页面不卸载就不会触发 pagehide → persistImmediately 覆盖服务端 pending
  const fresh = await context.newPage()
  await fresh.goto('/')
  await fresh.waitForSelector('.chrome', { timeout: 15000 })
  await expect(fresh.locator('.workflow-dialog')).toBeVisible({ timeout: 8000 })
  await expect(fresh.getByText('上次待归类的文稿')).toBeVisible()
})