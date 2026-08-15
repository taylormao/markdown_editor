# Folio 1.0.0

沉浸式 Markdown 写作台。界面参考 Effie 的退让式三栏：文稿箱、卡片列表、写作区。同一份文稿可在写作、预览、大纲、导图之间切换。

## 如何使用

```bash
npm install
npm run dev
```

浏览器打开 `http://127.0.0.1:5173`。

```bash
npm run build    # 类型检查 + 生产构建
npm run preview  # 预览构建结果
npm run lint     # oxlint
```

数据保存在本机浏览器 `localStorage`，键名 `folio.workspace.v1`。清站点数据会丢失文稿。导出请用工具栏的 Markdown 导出。

---

## 已完成功能

### 工作区与界面

- 三栏退让布局：左侧毛玻璃文稿箱 + 卡片列表，右侧编辑舞台
- 浅色 / 深色 / 跟随系统
- 焦点模式：隐藏侧栏与工具栏
- 自动保存（约 420ms 防抖），状态点显示「正在保存 / 已保存」
- 字数统计、逻辑行号（见下）
- 嵌套文件夹 + 文稿卡片（星标、摘要、时间）
- 标签栏：多文稿同时打开，点击或快捷键切换

### 写作编辑器（所见即所得）

基于 CodeMirror 6。闭合后的块会立刻渲染；光标进入块内部才回到源码。

- 标题、列表、引用、分割线、待办
- 表格闭合即渲染
- ` ```lang ` 代码块：写作区与预览均语法高亮
- ` ```mermaid ` 流程图等
- `$...$` / `$$...$$` KaTeX 公式
- Callout：`> [!NOTE|INFO|TIP|WARNING|ERROR|DANGER]`
- 脚注 `[^1]`
- 双链 `[[文稿名]]`：输入 `[[` 联想补全，点击在新标签打开
- `==` 超级语法（见下）

### 超级斜杠 `/`

路径筛选，例如 `/code/python`。

- 一级：表格、代码块、Mermaid、脚注、引用/Callout、公式、高亮、上下标、超级样式、圆圈/方框、列表、链接、图片、标题
- 表格：二级选行列
- 代码块：二级选语言（C/C++/Python/JS/TS/Go/Rust/SQL/Shell 等）
- 方向键 + 回车 / Tab / 再按 `/` 进入下级

### `==` 超级语法

| 写法 | 效果 |
|---|---|
| `==[-b -i -d]文字==` | 粗体 / 斜体 / 删除线 |
| `==[-h]文字==` | 黄底白字高亮 |
| `==[-c=red -bgc=#ffcead]文字==` | 前景 / 背景色（色名或 `#rrggbb`） |
| `==up2==` / `==down2==` | 上标 / 下标 |
| `==[-yuan]5==` | ⑤（0–20 用圈号） |
| `==[-fang]CTRL==` | 方框按键样式 |

### 预览 / 大纲 / 导图

- **预览**：完整渲染 Markdown + 上述扩展
- **大纲**：由标题和列表生成树
- **导图**：同一棵树的横向节点图

### 文件管理

- 右键或键盘 `Menu`：重命名、删除
- 文稿：移动到其他文件夹
- 文件夹：新建文稿、新建子文件夹；删除会递归子文件夹，文稿移到剩余第一个文件夹
- 双击也可重命名

### Esc 三态焦点

`Esc` 循环：编辑模式 → 标签选择模式 → 管理模式 → 编辑模式。切换时底部 toast，右上角状态条同步。

| 模式 | 操作 |
|---|---|
| 编辑 | 正常写作；离开时记住该文稿光标 |
| 选择 | `Tab` 下一标签，`F2` 改名，`Enter` 回编辑 |
| 管理 | 上下选文件夹/文稿/大纲，左右折叠展开，`F2` 改名，`Enter` 打开（大纲跳到对应位置） |

状态条示例：

- `编辑模式 : row17 : col36 : 435字 61词`（row 为逻辑块行）
- `选择模式 ：[当前标签文稿名]`
- `管理模式 ：[当前选中的文件夹或文稿名]`

### 逻辑行号

不是物理换行。标题、空行、段落（可多行）、列表项（含子项）、整张表、整段代码/Mermaid/公式/Callout、独立图片或链接，各算 1 行。`==` 样式跟所在段落走。

### 其他快捷键

| 键 | 作用 |
|---|---|
| `Esc` | 编辑 / 选择 / 管理循环 |
| `Ctrl+\` | 侧栏 |
| `Ctrl+.` | 焦点模式 |
| `Ctrl+N` | 新建文稿 |
| `Ctrl+1/2/3/4` | 写作 / 预览 / 大纲 / 导图 |
| `Menu` | 文件列表右键菜单 |

---

## 技术栈

| 层 | 选型 |
|---|---|
| UI | React 19 + TypeScript + Vite 8 |
| 编辑器 | CodeMirror 6 + `@codemirror/lang-markdown` + `@codemirror/language-data` |
| 公式 | KaTeX |
| 图表 | Mermaid（动态 import） |
| 代码高亮 | highlight.js |
| Lint | oxlint |
| 状态 | 自研 `useSyncExternalStore` 工作区 store，非 Redux |
| 持久化 | `localStorage` JSON 快照 |

设计取舍：本机无 Rust，桌面壳（Tauri）未接入；热路径仍按块更新，避免整篇重解析。

---

## 项目结构

```
markdown_editor/
├── index.html
├── package.json
├── src/
│   ├── App.tsx                 # 壳、快捷键、视图切换
│   ├── main.tsx
│   ├── index.css
│   ├── types.ts
│   ├── components/             # 侧栏、标签、工具栏、右键、大纲/导图、代码/Mermaid
│   ├── editor/                 # CodeMirror 与实时装饰
│   │   ├── EditorPane.tsx
│   │   ├── live-blocks.ts      # 表格/代码/Mermaid 闭合渲染
│   │   ├── super-syntax.ts     # == 语法
│   │   ├── math-syntax.ts
│   │   ├── wiki-syntax.ts / wiki.ts
│   │   ├── callouts.ts
│   │   └── slash/              # / 命令盘
│   └── lib/
│       ├── workspace-store.ts  # 全局状态
│       ├── storage.ts          # localStorage
│       ├── render-markdown.tsx # 预览解析
│       ├── document-tree.ts    # 大纲树
│       ├── logical-line.ts     # 逻辑行
│       ├── folders.ts
│       ├── chrome-keys.ts      # Esc 去重
│       ├── math.ts / mermaid.ts
│       └── sample.ts           # 首次种子文稿
└── public/
```

---

## 数据存放

- **位置**：浏览器 `localStorage['folio.workspace.v1']`
- **内容**：`folders`（含 `parentId`）、`sheets`（标题、正文、星标、时间）、`activeFolderId`、`activeSheetId`、`openTabIds`、`theme`
- **运行时不落盘**：视图、Esc 模式、光标记忆、折叠展开、toast
- **标题**：取正文第一行非空文本；重命名会改第一行标题

换电脑或清缓存即丢失。正式备份请导出 `.md`。

---

## 版本

当前 **1.0.0**。此前迭代见 git tag：`v0.2.0` 预览 … `v0.8.0` 嵌套文件夹。
