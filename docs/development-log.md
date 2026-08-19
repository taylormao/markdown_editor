# Folio 开发日志

## v1.4.1 - 2026-08-19

### ContextMenu 悬浮层被编辑区遮挡

侧栏右键菜单使用 `position: fixed` 定位，但父级 `.glass-rail` 的 `backdrop-filter` 会创建包含块与层叠上下文，导致菜单被限制在侧栏内部；flyout 延伸进编辑区时会被 CodeMirror 的 `cm-scroller` 拦截点击。

修复方式：将菜单通过 `createPortal(document.body)` 挂载到 `body`，脱离 `.glass-rail` 的包含块。

### 自动化测试套件

按 1.4.0 基线（PARA 组织、收集箱工作流、超级密码、软删除、指纹追踪、稳定双链）补齐三层测试：

- **单元测试**（Vitest + jsdom）：`test/unit/` 7 个文件覆盖 frontmatter、document-tree、wiki-scan、workspace-io、sheet-tracking、templates、workspace-folders，共 8 个文件 109 用例。
- **Store 集成测试**：`test/store/workspace-store.test.ts`（30 用例）覆盖状态机关键路径。
- **E2E 测试**（Playwright + 真实 Chromium）：`test/e2e/folio.spec.ts` 10 用例覆盖启动渲染、快速新建、目录内新建、结束写作归类、手动移动密码、软删除、四视图切换、侧栏搜索、启动待归类清单。

测试自包含：`test/e2e/seed.ts` 提供确定性工作区 fixture，`beforeAll` 写入服务端、`beforeEach` 完整还原，不依赖 `data/workspace.json` 当前内容（该文件会被手动使用或 `createSeed()` 随机 id 重新生成）。

一键运行：`npm run test`（单元/集成）、`npm run test:e2e`、`npm run test:all`（全部）、`node scripts/test-suite.ts`（依赖检查 + 汇总 + 退出码）。

### E2E 排障要点（已固化为测试代码）

- **420ms 防抖落盘**：UI 操作后服务端快照约 420ms 后才更新，涉及新建/归类的断言用 `expect(...).toPass()` 轮询。
- **pagehide 覆盖服务端**：`pagehide` 时 `persistImmediately` 用内存空 tracking 覆盖服务端预置数据，且 `page.route` 拦不住 unload 时的 keepalive fetch；启动弹窗用例改用 `context.newPage()` 全新页面加载规避。
- **选择器歧义**：视图按钮用 `getByRole('button', { name, exact: true })`，避免与编辑器正文或「结束写作」文本冲突。
- **定位新建稿**：收集箱 seed 中已有 project 模板文稿，新建稿必须用 `snap.activeSheetId` 定位，不能按 `content.includes('template: project')` 查找。

### 验证结果

- Vitest 109/109 通过；Playwright E2E 10/10 通过；`node scripts/test-suite.ts` 退出码 0。
- 测试过程修复的真实 UI bug：ContextMenu portal 化（见上文）。

## v1.3.1 - 2026-08-17

### 刷新后编辑器空白

刷新 `http://127.0.0.1:5173/` 后，React 的 `EditorPane` 初始化失败，页面只剩空白。Vite 控制台报告：

```text
RangeError: Block decorations may not be specified via plugins
```

错误发生在创建 CodeMirror `EditorView` 时。当前文稿包含表格和代码围栏，`live-blocks.ts` 会用 `Decoration.replace({ block: true })` 把这些 Markdown 块替换成可视化挂件，但该装饰由 `ViewPlugin` 动态提供。CodeMirror 明确禁止插件动态提供会影响块布局的装饰，因此在编辑器首次渲染时抛出异常，并使整个 `EditorPane` 组件退出渲染。

这与前一次 YAML 封面卡片导致的空白页属于同一类 CodeMirror 装饰问题，但根因不同：前一次是 YAML frontmatter 在编辑器内部被替换；本次是代码块、Mermaid 和表格的 block decoration 由错误的扩展类型提供。

### 修复过程

1. 根据错误堆栈定位到 `EditorPane.tsx` 创建 `EditorView` 的位置。
2. 逐项检查编辑器加载的扩展：`superSyntax`、`mathSyntax`、`liveBlocks`、`wikiSyntax` 和 `calloutDecor`。
3. 在 `live-blocks.ts` 找到唯一的 `block: true` 装饰，并确认它由 `ViewPlugin.fromClass` 提供。
4. 阅读当前安装版本的 `@codemirror/view` 源码，确认 CodeMirror 会拒绝插件提供的 block decoration，以及插件提供的跨换行 replacement。
5. 将 `liveBlocks` 改为 `StateField<DecorationSet>`，通过 `EditorView.decorations.from(field)` 提供静态装饰。
6. 将构建装饰所需的输入从 `EditorView` 收敛为 `EditorState`；挂件点击时再通过 `EditorView.findFromDOM()` 定位所属编辑器。
7. 全仓搜索所有 `Decoration.replace`、`Decoration.widget`、`block: true` 和 `ViewPlugin` 用法，继续排查同类隐患。

### 同类问题修复

- `math-syntax.ts`：`$$...$$` 使用 `[\s\S]` 匹配多行公式，原实现可能让 `ViewPlugin` 提供跨换行 replacement，并触发另一种 CodeMirror RangeError。已同样迁移到 `StateField`。
- `wiki-syntax.ts`：原双链正则允许 `[[...]]` 跨行匹配。已明确禁止换行，避免动态插件生成跨行 replacement。
- `super-syntax.ts`：装饰仅匹配单行内容，不含 block decoration，保留现状。
- `callouts.ts`：仅使用合法的 `Decoration.line`，不替换换行，保留现状。

### 其他修正

- 修正 `.gitignore` 中 `.omo/` 被粘在注释后的问题，确保 OpenCode 会话状态不会进入版本库。
- 将 `000-Template/` 中 11 个由 `templates.ts` 生成的 Markdown 模板纳入版本控制。
- 将项目版本和 lockfile 根版本同步为 `1.3.1`，并发布 `v1.3.1` 标签。

### 验证结果

- `npm run lint`：0 warnings，0 errors。
- `npm run build`：TypeScript 检查和 Vite 生产构建通过。
- 真实 Edge 浏览器刷新：页面正常显示，CodeMirror 编辑器可见，控制台无页面异常。
- 运行时分别创建围栏代码块、Markdown 表格和多行 `$$...$$` 数学块：EditorView 均成功创建，相关挂件正常生成。
- 使用旧的错误模式动态构造 ViewPlugin block decoration：稳定复现原 RangeError；切换到修复后的 StateField 实现后，相同内容正常渲染，确认修复针对根因。

### Git 记录

- `7b14792` Fix block preview decorations on refresh
- `108c31d` Prevent multiline decoration crashes
- `ae72d85` Ignore OpenCode session state
- `3269c37` Release Folio 1.3.1
- 标签：`v1.3.1`

## 收集箱文稿追踪与待归类模型（已实现）

### 设计目标

Ctrl+N 创建的非 `spark` 文稿会先进入收集箱，作者也可以从侧栏、标签页、搜索结果或双链打开收集箱中的旧文稿。系统需要准确区分以下情况：

- 文稿只是被打开或阅读，没有被修改；
- 文稿曾经被修改，但最终撤销并恢复到本轮编辑前的状态；
- 文稿在本轮结束时仍然存在真实变化；
- 文稿以前已经产生过有效内容变化，但作者选择暂不归类；
- 文稿由 Ctrl+N 新建，尚未继续输入，但创建行为本身已经使它需要归类。

如果只使用一个“是否编辑过”的布尔值，上述情况会被混在一起。只打开文稿可能被误判为已编辑；修改后完全撤销仍可能触发归类；本轮没有变化又可能错误清除历史待归类状态。为解决这些混乱，设计采用三个职责互不重叠的状态：`baselineFingerprint`、`touched` 和 `pendingClassification`。

### 三状态模型

#### `baselineFingerprint`

表示文稿进入本轮编辑追踪时的内容基线。它是标题、用户可编辑的 YAML 元信息和 Markdown 正文经过规范化后计算得到的 SHA-256 指纹。

计算时不纳入光标位置、视图模式、标签页顺序和内部时间戳等运行状态。由系统自动维护的 `updated` 字段也需要从指纹输入中排除或标准化，避免正文已经撤销，但时间字段变化导致误判。

基线只回答一个问题：

> 当前内容是否与本轮开始编辑时完全一致？

#### `touched`

表示本轮写作会话中是否发生过修改动作。正文、标题或 YAML 第一次发生变化时设为 `true`；仅打开、阅读、预览、切换标签和通过双链跳转不会改变它。

`touched` 是会话状态，不代表最终内容一定不同。用户可能修改后撤销，因此结束写作时还需要比较当前指纹与基线指纹。

#### `pendingClassification`

表示文稿是否仍需由作者决定归入正式 type 目录。它是跨会话状态，记录会一直保留：`true` 表示待归类（默认），自动归类或手动移出收集箱后置为 `false`（已分类）；只有删除或改为不参与归类的类型后才清除。

`pendingClassification` 与 `touched` 的区别：

- `touched`：这一次写作会话是否动过文稿；
- `pendingClassification`：这篇文稿是否仍欠一次归类决定。

本轮结束后 `touched` 应重置，但用户选择“暂留收集箱”时，`pendingClassification` 必须继续保留。

### 状态组合及含义

| 基线 | touched | pendingClassification | 实际含义 |
|---|---:|---:|---|
| 无 | false | false | 普通未追踪文稿，或收集箱中的 `spark` |
| 有 | false | false | 收集箱内非 `spark` 文稿已打开，但本轮尚未修改 |
| 有 | true | false | 本轮首次修改了原本无需归类的旧文稿，等待结束时比较 |
| 无 | false | true | 历史上已经确认需要归类，但当前没有进行新的编辑会话 |
| 有 | false | true | 历史待归类文稿在本轮被打开，但尚未修改 |
| 有 | true | true | 历史待归类文稿本轮又被修改，既要比较本轮变化，也不能丢失既有待归类状态 |

不存在“无基线但 `touched = true`”的合法状态。第一次修改发生前必须已经同步截取原始内容，并开始计算基线；只有基线准备好后才能持久化 `touched = true`。

### 指纹建立时机

启动程序时只扫描收集箱中 `type != spark` 的文稿，用于生成“历史待归类”和“继续编辑”清单，不需要立即为所有文稿计算指纹。

只有当一篇符合追踪条件的文稿实际进入编辑状态时才建立基线：

```text
位于收集箱
AND type != spark
AND 当前会话尚无该文稿的基线
```

系统应先同步截取标题、YAML 和正文组成的不可变字符串，再异步计算 SHA-256。这样即使作者打开后立刻输入，第一个字符也不会污染基线。

如果文稿只是阅读，没有发生修改，基线仅保存在内存中；关闭标签或结束会话时可以直接丢弃，不写入硬盘。第一次修改发生时，才把基线和 `touched = true` 持久化，以便浏览器被直接关闭后仍能在下次启动恢复判断。

### 本轮编辑结束时的判断

点击工具栏“结束本次写作”、使用对应快捷键，或关闭最后一个文稿标签触发辅助提醒时，只处理 `touched = true` 的收集箱非 `spark` 文稿。

系统计算当前指纹 `currentFingerprint`，再与 `baselineFingerprint` 比较。

#### 当前指纹与基线相同

代表文稿虽然发生过修改动作，但最终已经恢复到本轮开始前的状态：

```text
currentFingerprint == baselineFingerprint
```

处理规则：

- 将 `touched` 重置为 `false`；
- 清除本轮基线；
- 不产生新的待归类状态；
- 不在本轮结束归类清单中显示；
- 如果此前 `pendingClassification` 已经是 `true`，仍然保持 `true`，因为本轮恢复原状不能取消历史上尚未完成的归类决定。

#### 当前指纹与基线不同

代表本轮结束时仍存在真实内容变化：

```text
currentFingerprint != baselineFingerprint
```

处理规则：

- 文稿进入“结束本次写作”的归类清单；
- 作者选择归类时，系统按 type 自动移动到对应目录，不触发超级密码；
- 归类完成后保留追踪记录，清除本轮基线并将 `pendingClassification` 置为 `false`（已分类，不再待归类）；
- 作者选择暂留收集箱时，将 `pendingClassification` 设为 `true`，重置 `touched`，并清除本轮基线；
- 暂留文稿在下次启动时继续出现在历史待归类清单，直到作者明确处理。

### Ctrl+N 新建文稿的特殊规则

Ctrl+N 选择 type 和模板后创建的非 `spark` 文稿一律先进入收集箱。即使作者没有继续输入，选择模板并生成 id、YAML 和正文骨架本身已经是一项明确的创作行为，因此新建完成后直接设置：

```text
pendingClassification = true
```

新建文稿不需要依赖 `touched` 才获得待归类状态。`spark` 是收集箱的正式内容，不参与自动归类流程，也不建立这套追踪状态。

### 所有打开入口共享同一机制

追踪逻辑不能只绑定在启动清单或某个按钮的点击事件中，否则从其他入口打开的文稿会漏记。以下入口必须执行完全相同的规则：

- 启动清单中选择“继续编辑”；
- 在侧栏收集箱中手动点击文稿；
- 从已有标签页重新进入文稿；
- 通过搜索结果打开文稿；
- 通过双链跳转打开文稿；
- 应用启动时恢复上次已打开的标签。

实现上应由工作区状态层统一负责：任何入口调用“打开文稿”时，工作区先判断文稿是否位于收集箱、是否为非 `spark`、是否已有会话基线；任何入口修改正文、YAML 或标题时，工作区统一设置首次修改状态。界面组件只表达用户动作，不各自维护一套追踪逻辑。

这种集中式设计解决了以下问题：

- 不会出现启动清单打开的文稿能被追踪，而侧栏或双链打开的文稿不能被追踪；
- 同一文稿在多个标签和入口间切换时复用同一个基线，不重复计算；
- “打开”和“编辑”被严格区分，阅读行为不会制造归类提醒；
- 所有标题、YAML 和正文修改都走同一状态转换，不因界面入口不同而产生不一致；
- 后续接入实体文件同步、插件系统或其他导入入口时，只需复用工作区追踪接口。

### 启动与结束写作流程

应用启动后的顺序固定为：

1. 扫描并展示历史 `pendingClassification = true` 的文稿，先让作者决定是否归类；
2. 未选择归类的文稿继续保持待归类状态；
3. 再展示收集箱中可继续编辑的非 `spark` 文稿；
4. 作者选中的文稿全部打开为标签页，第一个选中项获得焦点并进入编辑模式；
5. 只为实际进入编辑状态的文稿建立会话基线。

结束本次写作的主要入口是工具栏按钮和快捷键 `Ctrl+Shift+E`；关闭最后一个标签页作为辅助提醒。进入管理模式不触发整理。浏览器被直接关闭时不尝试弹出复杂对话框，只持久化已经存在的基线、`touched` 和待归类状态，等下次启动继续处理。

### 资源与存储开销

SHA-256 指纹原始长度为 32 字节，保存为十六进制字符串后为 64 个字符。包含 sheet id 和 JSON 字段后，一条持久化记录通常只有约 150 至 250 字节。

系统不会为全部文章建立永久指纹，只追踪收集箱中非 `spark` 且实际进入编辑状态的文稿。输入过程中不会逐字符计算哈希，只设置 `touched = true`；基线在进入编辑时计算一次，当前指纹在结束写作时对 touched 文稿计算一次。普通 Markdown 文稿的计算开销通常低于一毫秒到数毫秒，不会产生可感知卡顿。

### 实现结果

该设计已在 `v1.3.1` 之后的文件组织迭代中落地：

- `workspace-folders.ts` 定义固定 PARA 目录、systemKey、目录到 type 的映射和旧工作区迁移；原“文稿”目录迁移为 `999-未分类`，原文稿和 id 保持不变。
- `sheet-tracking.ts` 负责规范化内容并通过浏览器 Web Crypto 计算 SHA-256。
- `workspace-store.ts` 统一处理所有打开入口、首次修改、结束写作、启动归类、继续编辑、自动归类和手动危险操作。
- `WorkspaceSnapshot.tracking` 持久化 `baselineFingerprint`、`touched` 与 `pendingClassification`，工作区文件版本升级为 3。
- `pagehide` 通过 keepalive 保存已知状态；浏览器关闭时不显示复杂对话框。
- `WorkflowDialogs.tsx` 实现启动时“先归类、后继续编辑”以及结束本次写作清单。
- `TemplatePicker.tsx` 实现 Ctrl+N 的 type→template 两级键盘选择；目录内新建只显示该目录 type 的模板。
- 浏览器可能保留 `Ctrl+N` 用于新窗口，因此同时提供 `Alt+N` 和侧栏顶部“+”作为可靠的快速新建入口；桌面壳接入后仍可使用原生 `Ctrl+N`。
- `PasswordGate.tsx` 实现首次设置和后续验证超级密码；明文密码保存于被 Git 忽略的 `data/config.json`，仓库提供 `data/config.example.json`。
- 文稿软删除会移动到 `999-未分类` 并写入 `status: trashed`；永久删除继续保留为后续任务。
- `wiki-scan.ts` 在保存时把可以解析的 `[[标题]]` 规范为 `[[稳定 id]]`，未解析的未来链接保持原样。
- `000-Template/目录说明书.md` 记录 PARA 英文含义、type 映射、新建规则和归类规则。

### 实现验证

- 旧的两目录工作区启动后自动生成 15 个固定目录，原有 2 篇文稿完整保留，未产生 QA 测试文稿残留。
- Ctrl+N 能显示 9 个 type，再显示该 type 的具体模板；新建 meeting 文稿首先进入收集箱。
- 结束写作清单正确显示 `meeting → 120-会议`，自动归类不要求超级密码。
- 310-视频目录的新建入口只显示“视频笔记”和“视频系列”；300-资源等结构父目录不提供“新建文稿”。
- 第一次手动移动显示“设置超级密码”，后续危险操作显示“输入超级密码”。
- 删除文稿经过超级密码后仍保留，并移动到 `999-未分类`。
- 实际编辑后，workspace 文件出现 64 位基线指纹、`touched: true` 和既有待归类状态。
- 手写 `[[一个尚未展开的念头]]` 保存后自动变为对应的稳定 UUID 引用。
- Edge 浏览器实际操作期间 Folio 页面无 pageerror；`npm run lint` 为 0 warnings/0 errors，`npm run build` 通过。
- 模板选择弹窗在 390×844 窄屏采用两列布局，9 个 type 全部位于 460px 高的弹窗内，`scrollHeight` 与 `clientHeight` 一致；弹窗提供可见关闭按钮，不存在底部裁切。

### 后续技术债

`workspace-store.ts` 在本轮之前已经承担大量编辑器、标签页、文件夹和持久化协调职责。本轮将目录迁移、指纹计算和配置存储的纯逻辑分别拆入独立模块，但 store 本身仍然偏大。后续应在建立自动化状态机回归测试后，将管理模式、文稿操作和写作会话工作流进一步拆成独立 store slice，避免在缺少测试保护时进行高风险的大规模重构。

## v1.4.0 发布前全量审计 - 2026-08-17

在完成 PARA 侧栏、收集箱写作会话、超级密码和稳定双链后，对 `src/`、`server/`、持久化 API、CodeMirror 扩展和全部新增调用点进行了第二轮全量检查。

### 本轮发现并修复

- **指纹完成竞态**：用户刚输入后立即点击“结束写作”时，SHA-256 promise 可能尚未把 `touched` 写入持久化状态，导致文稿漏出归类清单。新增同步的 `touchedThisSession` 集合，结束流程会等待对应基线 promise 后再比较当前指纹。
- **Escape 穿透**：模板、密码、启动清单和结束写作弹窗打开时，Esc 可能同时关闭弹窗并切换底层编辑/选择/管理模式。现在统一由 `handleEscape()` 按弹窗优先级处理，事件不会穿透。
- **损坏快照覆盖风险**：原 `workspace.json` 无效时可能直接写入 seed。新增 `workspace.backup.json` 恢复链，读取顺序为主快照 → 自动备份 → seed，并使用临时文件重命名方式写入，降低半写文件风险。
- **系统目录删除不持久**：系统目录删除后，启动迁移会重新创建。新增 `disabledSystemFolderKeys` 到 workspace v3，密码确认删除的系统目录在下次启动保持禁用。
- **无效待归类记录**：已移出收集箱或已改成 `spark` 的 tracking 记录可能继续显示。启动清单现在同时校验 sheet 存在、仍位于收集箱且 type 非 `spark`。
- **移动后的追踪残留**：手动移出收集箱时会清除会话基线、touched 和当次新建标记，保留记录并把 `pendingClassification` 置为 `false`（已分类）；移入收集箱时置为 `true`（重新待分类）并重新建立会话基线。
- **软删除标签状态**：删除文稿后若还有其他标签，会切换到剩余标签；若是最后标签，则保留该文稿标签并显示其已移动到 `999-未分类` 的状态，避免无标签但仍显示编辑器的矛盾状态。
- **模态框移动端裁切**：模板选择弹窗增加视口高度限制、内部滚动、可见关闭按钮和 520px 以下两列布局。390×844 实测弹窗高约 460px，全部 9 个 type 可见。
- **浏览器 Ctrl+N 限制**：Chrome/Edge 保留 Ctrl+N。保留该绑定供桌面壳使用，同时增加 `Alt+N` 和侧栏顶部 `+` 作为浏览器可靠入口。
- **跨行/block decoration**：再次确认代码块、表格、Mermaid 和多行公式都通过 StateField 提供会改变布局的 decoration，wiki 装饰限制为单行。

### 数据恢复与验证

- 使用真实 API 人为写坏 `data/workspace.json`，GET `/api/workspace` 成功从 `workspace.backup.json` 恢复 2 篇文稿、15 个目录和 workspace v3，随后恢复用户原文件。
- QA 全程使用临时备份；最终用户工作区仍为原有 2 篇文稿，无测试文稿或测试密码残留。
- `.gitignore` 覆盖 `workspace.json`、自动备份、`config.json`、`.omo/`、`.playwright-mcp/`、`project_all_files.txt` 和 `tree_output.txt`。
- oxlint 0 warning / 0 error；TypeScript 与 Vite 生产构建通过。
