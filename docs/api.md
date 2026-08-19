# Folio 工作区 API 参考

> 适用版本：**1.5.0**。本文档是 `workspace` 对象（62 个方法）与 `useWorkspace()` 的权威 API 参考。
> 签名权威来源：`src/lib/workspace-store/types.ts` 的 `WorkspaceActions` 接口，由 `test/store/workspace-api-shape.test.ts` 硬契约锁定（方法名集合拆分前后逐字一致，不得增删）。

## 入口

```ts
import { workspace, useWorkspace } from '../lib/workspace-store'
```

- **`workspace`**：模块级单例对象，暴露全部 62 个方法（`subscribe` / `get` + 60 个动作）。
- **`useWorkspace()`**：React Hook，基于 `useSyncExternalStore` 订阅 `workspace`，返回当前 `WorkspaceState`；组件数据变更时自动重渲染。

```ts
function useWorkspace(): WorkspaceState
```

## Store 契约（2）

| 方法 | 签名 | 说明 |
|---|---|---|
| `subscribe` | `(listener: Listener) => () => void` | 订阅状态变更；`Listener = () => void`。返回取消订阅函数。 |
| `get` | `() => WorkspaceState` | 同步读取当前完整状态快照。 |

## 状态类型

### WorkspaceState（`workspace.get()` 返回）

```ts
type WorkspaceState = WorkspaceSnapshot & {
  view: 'write' | 'preview' | 'outline' | 'map'
  sidebarOpen: boolean
  focusMode: boolean
  query: string
  saveState: 'idle' | 'saving' | 'saved'
  chromeMode: 'edit' | 'select' | 'manage'
  caretBySheet: Record<string, number>
  caret: { line: number; col: number }
  toast: string
  collapsedFolderIds: string[]
  expandedSheetIds: string[]
  manageIndex: number
  renameTarget: { kind: 'folder' | 'sheet'; id: string } | null
  templatePickerFor: string | null
  templatePickerMode: 'folder' | 'quick'
  templatePickerType: DocType | null
  yamlEditorOpen: boolean
  yamlIssues: ValidationIssue[]
  hydrated: boolean
  config: { superPassword: string }
  passwordGateLabel: string
  startupStep: 'classify' | 'continue' | null
  finishWritingIds: string[]
  searchOpen: boolean
  searchQuery: string
  searchResults: SearchResult[]
}

type WorkspaceSnapshot = {
  folders: Folder[]
  sheets: Sheet[]
  activeFolderId: string
  activeSheetId: string
  openTabIds: string[]
  theme: 'system' | 'light' | 'dark'
  tracking: Record<string, SheetTracking>
  disabledSystemFolderKeys: string[]
}
```

### 关键子类型

```ts
type Folder = {
  id: string
  name: string
  order: number
  parentId: string | null
  systemKey?: SystemFolderKey   // inbox | templates | projects | areas | resources | archives | uncategorized ...
  docType?: string
}

type Sheet = {
  id: string
  folderId: string
  title: string
  content: string       // frontmatter + body 的完整 Markdown
  createdAt: number
  updatedAt: number
  starred: boolean
}

type SheetTracking = {
  baselineFingerprint?: string   // 编辑前 SHA-256 指纹
  touched: boolean
  pendingClassification: boolean
}

type DocType =
  | 'spark' | 'daily' | 'review' | 'video' | 'literature'
  | 'tutorial' | 'clip' | 'project' | 'meeting'

type TemplateId =
  | 'spark' | 'daily' | 'review'
  | 'video-episode' | 'video-series' | 'literature'
  | 'tutorial-note' | 'tutorial-publish' | 'clip'
  | 'project' | 'meeting'

type ValidationIssue = { field: string; message: string }

type YamlValue = string | number | boolean | null | YamlValue[] | { [key: string]: YamlValue }

type ManageItem =
  | { kind: 'folder'; id: string }
  | { kind: 'sheet'; id: string }
  | { kind: 'outline'; sheetId: string; line: number; text: string }

type SearchResult = {
  id: string
  title: string
  content: string
  folderId: string
  folderPath: string
  fileName: string
}
```

## 方法清单（62）

方法按所属 slice 分组。`requestXxx` 前缀表示**受保护操作**（需要超级密码，统一走 `runProtected` 密码门）。

### 1. chrome slice —— 视图 / UI / 密码门 / YAML / 重命名 / 光标与模式（17）

| 方法 | 签名 | 说明 |
|---|---|---|
| `setView` | `(view: ViewMode) => void` | 切换视图：write / preview / outline / map。同时退出焦点模式。 |
| `setQuery` | `(query: string) => void` | 设置侧栏搜索过滤词。 |
| `toggleSidebar` | `() => void` | 切换侧栏显隐，退出焦点模式。 |
| `toggleFocus` | `() => void` | 切换焦点模式（焦点时侧栏关闭）。 |
| `cycleTheme` | `() => void` | 主题循环：system → light → dark → system。持久化。 |
| `setCaret` | `(sheetId: string, pos: number, line: number, col: number) => void` | 记录文稿光标位置与行列。 |
| `setChromeMode` | `(mode: ChromeMode, message?: string) => void` | 设置界面模式（edit/select/manage）；进入 select/manage 时强制展开侧栏；manage 时重算 `manageIndex`。可选 toast 消息。 |
| `cycleChromeMode` | `() => void` | 模式循环：edit → select → manage → edit。 |
| `nextTab` | `() => void` | 切换到下一个打开的标签；切换前经 `blockLeave` 校验。 |
| `openAtLine` | `(sheetId: string, line: number) => void` | 打开文稿并定位到指定逻辑行（建立追踪基线）。 |
| `requestRename` | `(target: { kind: 'folder' \| 'sheet'; id: string }) => void` | 打开内联重命名（不触发密码门，重命名动作本身受保护的是写入）。 |
| `clearRename` | `() => void` | 关闭内联重命名。 |
| `setSuperPassword` | `(password: string) => void` | 保存超级密码到本地 config（明文，Git 忽略）。 |
| `submitPassword` | `(password: string) => boolean` | 验证密码并执行挂起的受保护动作。首次调用（无密码时）即设置密码。返回是否通过。 |
| `closePasswordGate` | `() => void` | 关闭密码门，丢弃挂起的受保护动作。 |
| `openYamlEditor` | `() => void` | 打开 YAML 编辑器（仅 edit 模式有效）。 |
| `closeYamlEditor` | `() => void` | 关闭 YAML 编辑器。 |

### 2. folders slice —— 目录增删改（5）

| 方法 | 签名 | 说明 |
|---|---|---|
| `createFolder` | `(parentId?: string \| null) => string` | 创建「新文件夹」到指定父目录（默认根），返回新目录 id。持久化。 |
| `requestCreateFolder` | `(parentId?: string \| null) => void` | 受保护版创建子文件夹（走密码门）。 |
| `renameFolder` | `(id: string, name: string) => void` | 重命名目录。持久化。 |
| `deleteFolder` | `(id: string) => void` | 递归删除目录树（子树内文稿移动到剩余第一个目录）。持久化。 |
| `requestDeleteFolder` | `(id: string) => void` | 删除目录；系统预设目录走密码门，用户目录直接删除。 |

### 3. manage slice —— 管理模式列表导航（6）

| 方法 | 签名 | 说明 |
|---|---|---|
| `moveManage` | `(delta: number) => void` | 管理模式光标上下移动（循环，负数安全）。 |
| `currentManageItem` | `() => ManageItem \| null` | 返回当前高亮的扁平列表项。 |
| `toggleManageExpand` | `() => void` | 切换目录折叠 / 文稿大纲展开。 |
| `collapseManage` | `() => void` | 折叠当前目录 / 收起大纲 / 收起后跳到父目录。 |
| `expandManage` | `() => void` | 展开当前目录 / 展开文稿大纲。 |
| `confirmManage` | `() => void` | 确认选择：目录 → 进入该目录；文稿/大纲项 → 打开文稿定位光标。 |

### 4. navigation slice —— 选择与跳转（5）

| 方法 | 签名 | 说明 |
|---|---|---|
| `selectFolder` | `(id: string) => void` | 选择目录并打开其中第一篇文稿（经 `blockLeave` 校验）。 |
| `selectSheet` | `(id: string) => void` | 打开文稿为标签（经 `blockLeave` 校验，建立追踪基线）。 |
| `openSheetByTitle` | `(title: string) => void` | 按标题打开文稿（委托 `openWiki`）。 |
| `openWiki` | `(ref: string) => void` | 双链跳转：先按稳定 id 匹配，再按标题匹配。 |
| `closeTab` | `(id: string) => void` | 关闭标签；关最后一个标签触发结束写作整理。 |

### 5. templates slice —— 新建文稿（7）

| 方法 | 签名 | 说明 |
|---|---|---|
| `requestNewSheet` | `(folderId?: string) => void` | 打开模板选择器（folder 模式）；结构父目录（无 docType）时拒绝并 toast。 |
| `requestQuickSheet` | `() => void` | 打开模板选择器（quick 模式），目标为收集箱。 |
| `selectTemplateType` | `(type: DocType) => void` | 选择文稿 type（进入模板二级选择）。 |
| `clearTemplateType` | `() => void` | 返回 type 一级选择。 |
| `closeTemplatePicker` | `() => void` | 关闭模板选择器。 |
| `createSheetFromTemplate` | `(templateId: TemplateId, folderId?: string) => void` | 从模板创建文稿；daily 同日期去重（已存在则直接打开）；quick/收集箱且非 spark 时标记待归类。持久化。 |
| `createSheet` | `(folderId?: string) => void` | 便捷入口：委托 `requestNewSheet(folderId)`。 |

### 6. sheets slice —— 文稿操作（10）

| 方法 | 签名 | 说明 |
|---|---|---|
| `renameSheet` | `(id: string, title: string) => void` | 重命名文稿：更新标题、frontmatter title 与首行标题（标记 touched）。持久化。 |
| `requestRenameSheet` | `(id: string, title: string) => void` | 受保护版重命名文稿（走密码门）。 |
| `applyFrontmatter` | `(id: string, attrs: Record<string, YamlValue>) => void` | 应用 YAML 编辑：合并 related 双链、更新 `updated` 时间戳；校验通过则关闭 YAML 编辑器。 |
| `updateSheetContent` | `(id: string, content: string) => void` | 更新文稿内容：规范化双链、合并 related、YAML 必填校验（非激活文稿缺字段时阻止）。持久化。 |
| `toggleStar` | `(id: string) => void` | 切换星标。持久化。 |
| `moveSheet` | `(id: string, folderId: string) => void` | 移动文稿；移出收集箱清会话基线并标记已分类，移回收集箱重建追踪。持久化。 |
| `requestMoveSheet` | `(id: string, folderId: string) => void` | 受保护版移动文稿（走密码门）。 |
| `classifySheet` | `(id: string) => void` | 按 type 自动归类到对应目录（不需要密码）。持久化。 |
| `deleteSheet` | `(id: string) => void` | 软删除：移动到 999-未分类 + `status: trashed`；关闭对应标签，最后一个标签时保留并显示已删除状态。持久化。 |
| `requestDeleteSheet` | `(id: string) => void` | 受保护版删除文稿（走密码门）。 |

### 7. workflow slice —— 写作流程与持久化（10）

| 方法 | 签名 | 说明 |
|---|---|---|
| `prepareFinishWriting` | `() => Promise<void>` | 计算所有 touched 文稿的当前指纹，与基线比较后生成结束写作归类清单（`finishWritingIds`）。 |
| `finishWriting` | `(selectedIds: string[]) => void` | 确认结束写作：选中文稿按 type 归类，未选中的暂留收集箱。持久化。 |
| `closeFinishWriting` | `() => void` | 关闭归类清单（等价于 `finishWriting([])`）。 |
| `classifyPending` | `(selectedIds: string[]) => void` | 启动时处理历史待归类文稿，完成后进入继续编辑步骤。 |
| `openContinued` | `(selectedIds: string[]) => void` | 打开选中的继续编辑文稿为标签，首个获得焦点。 |
| `closeStartup` | `() => void` | 关闭启动步骤弹窗。 |
| `hydrate` | `() => Promise<void>` | 启动加载：主快照 → 备份恢复 → seed；系统目录迁移、旧稿打 spark 模板标 `needs_migration`；设置启动步骤（classify/continue）。失败静默置 `hydrated: true`。 |
| `exportBackup` | `() => void` | 导出完整工作区 JSON 备份到客户端。 |
| `persistImmediately` | `() => void` | 立即持久化当前快照（keepalive，用于 pagehide）。 |
| `importBackup` | `(file: File) => Promise<void>` | 从用户选择的 JSON 文件导入完整快照（覆盖工作区）。 |

## 内部契约（SliceContext / Core / Tracking）

以下接口不对外暴露，仅供 slice 工厂内部使用（`src/lib/workspace-store/types.ts`）。

### SliceContext（slice 依赖注入）

```ts
interface SliceContext {
  get(): WorkspaceState
  set(patch: Partial<WorkspaceState> | ((prev: WorkspaceState) => WorkspaceState), persist?: boolean): void
  toast(message: string): void
  blockLeave(nextId?: string): boolean   // 必填字段缺失时阻止切换文稿
  beginTracking(id: string): void
  markTouched(id: string): void
  clearTracking(id: string): Record<string, SheetTrackingRecord>
  sessionBaselines: Map<string, Promise<string>>
  createdThisSession: Set<string>
  touchedThisSession: Set<string>
  runProtected(label: string, run: () => void): void  // 挂起动作到密码门
  protectedAction: ProtectedActionRef
  currentSnapshot(): WorkspaceSnapshot
  actions: WorkspaceActions  // 组装完成后回填，供跨族调用延迟解析
}
```

### Core（state 唯一所有者）

```ts
interface Core {
  get(): WorkspaceState
  set(patch, persist?): void
  emit(): void
  persistSoon(): void       // 420ms 防抖持久化（未 hydrated 时跳过）
  currentSnapshot(): WorkspaceSnapshot
  toast(message: string): void  // 1.6s 自动消失
  subscribe(listener): () => void
}
```

### Tracking（会话级指纹追踪）

```ts
interface Tracking {
  beginTracking(id: string): void
  markTouched(id: string): void
  clearTracking(id: string): Record<string, SheetTrackingRecord>
  sessionBaselines: Map<string, Promise<string>>
  createdThisSession: Set<string>
  touchedThisSession: Set<string>
}
```

## 持久化行为

- `persist = true` 的操作触发 **420ms 防抖**保存到 `/api/workspace`（`data/workspace.json`），保存指示器 saving → saved → idle（1.6s）。
- `hydrated = false` 时 `persistSoon` 直接跳过（hydrate 前不持久化）。
- 受保护操作（`requestXxx`）统一经 `runProtected` 挂起到密码门，`submitPassword` 验证成功后执行，密码只存引用不存值。
