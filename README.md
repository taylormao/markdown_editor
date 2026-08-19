# Folio 1.4.0

Folio 是一个本地优先的沉浸式 Markdown 写作台。它以 CodeMirror 6 为编辑核心，通过 YAML frontmatter、稳定文稿 id、双链和 PARA 目录组织写作过程，并提供写作、预览、大纲和导图四种视图。

## 启动

```bash
npm install
npm run dev
```

浏览器打开 `http://127.0.0.1:5173/`。

```bash
npm run lint     # oxlint
npm run build    # TypeScript 检查 + 生产构建
npm run preview  # 预览生产构建
```

## 1.4.0 重点

- 固定 PARA 文件组织：收集箱、模板、项目、领域、资源、归档和未分类
- 9 个文稿 type、11 个模板；`templates.ts` 仍是应用内模板源
- `000-Template/` 保存由模板生成的 Markdown YAML 骨架和目录说明书
- 快速新建采用 type → 具体模板两级选择，新文稿先进入收集箱
- 目录内新建只显示该目录 type 对应的模板
- 收集箱非 `spark` 文稿使用 SHA-256 基线指纹追踪真实修改
- 启动时先处理待归类文稿，再选择继续编辑的文稿
- “结束写作”按 type 自动归类本轮完成的内容
- 超级密码保护手动移动、创建子目录、重命名和删除等危险操作
- 删除文稿为软删除：移动到 `999-未分类` 并标记 `status: trashed`
- 可解析的 `[[标题]]` 保存时规范为 `[[稳定 id]]`，重命名后显示当前标题
- `workspace.backup.json` 用于主快照损坏时自动恢复
- 修复 CodeMirror block / 跨行 decoration 导致的刷新空白问题

完整开发过程见 [`docs/development-log.md`](docs/development-log.md)。

## PARA 目录

```text
收集箱
000-模板
100-项目
  110-项目          project
  120-会议          meeting
200-领域
  210-每日          daily
  220-复盘          review
300-资源
  310-视频          video
  320-读书          literature
  330-收藏          clip
  340-publish       tutorial
400-归档
999-未分类
```

- `spark` 正式保留在收集箱。
- Ctrl+N / Alt+N 快速创建的其他 type 先进入收集箱。
- 项目父目录、领域父目录和资源父目录只负责组织；请在具体 type 子目录内创建文稿。
- 详细用途见 [`000-Template/目录说明书.md`](000-Template/目录说明书.md)。

## 文稿类型与模板

| type | 模板 | 用途 |
|---|---|---|
| `spark` | `spark` | 快速捕捉念头 |
| `daily` | `daily` | 每日反省，一天一篇，可补昨天 |
| `review` | `review` | 周回顾与阶段总结 |
| `video` | `video-episode` / `video-series` | 单集视频笔记与系列目录 |
| `literature` | `literature` | 读书和长文研究 |
| `tutorial` | `tutorial-note` / `tutorial-publish` | 技巧备忘与发布成稿 |
| `clip` | `clip` | 外部收藏、原因和下一步 |
| `project` | `project` | 项目状态、下一步和 backlog |
| `meeting` | `meeting` | 与会者、决议和待办 |

每篇模板文稿包含稳定 id，格式为：

```text
{YYYYMMDD}-{type}-{4位随机字符}
```

## 新建文稿

### 快速新建

使用以下任一入口：

- `Ctrl+N`：保留给能把该按键交给页面的环境和未来桌面壳
- `Alt+N`：浏览器中的可靠快捷键
- 侧栏顶部 `+`

流程：

1. 选择 type；
2. 使用上下键和 Enter 选择，或直接点击；
3. 再选择该 type 下的具体模板；
4. 文稿创建到收集箱。

注意：Chrome / Edge 通常将物理 `Ctrl+N` 保留为“新建浏览器窗口”，网页无法可靠拦截，因此浏览器中请使用 `Alt+N` 或侧栏 `+`。

### 目录内新建

在侧栏具体 type 文件夹上右键，或用管理模式的 Menu 键打开菜单，再选择“新建文稿”。系统只显示该目录对应的模板，文稿直接保存在当前目录。

## 收集箱写作流程

Folio 为收集箱中的非 `spark` 文稿维护三个状态：

- `baselineFingerprint`：本轮编辑前的 SHA-256 指纹
- `touched`：本轮是否发生过编辑动作
- `pendingClassification`：是否仍需决定归类位置

只打开、阅读、预览和切换标签不算编辑。正文、标题或 YAML 变化后才设置 touched；结束写作时再次计算指纹：

- 与基线相同：说明修改已完全撤销，不产生新的待归类状态
- 与基线不同：进入本轮归类清单
- 选择暂留：继续放在收集箱，下次启动仍提示
- 选择归类：按 type 自动移动，不要求超级密码

启动顺序固定为：

1. 处理历史待归类文稿；
2. 选择本次继续编辑的收集箱文稿；
3. 所选文稿以标签打开，第一个获得焦点。

点击工具栏“结束写作”或按 `Ctrl+Shift+E` 可主动整理。本轮最后一个待整理标签的关闭按钮也会触发提醒。浏览器直接关闭时只保存状态，不强行弹窗。

## 超级密码与危险操作

首次危险操作会要求设置超级密码。密码按已确定方案以明文保存在本地 `data/config.json`，该文件已被 Git 忽略。

需要密码：

- 手动移动文稿
- 创建文件夹或子文件夹
- 重命名文稿
- 删除文稿
- 删除系统预设文件夹

不需要密码：

- 系统自动按 type 归类
- 删除用户自行建立的文件夹

超级密码是本地操作确认机制，不是账户认证或远程安全边界。开发服务器的 API 只应在可信本机环境使用，不应直接暴露到公网。

## 软删除

删除文稿不会立即销毁内容：

1. 输入超级密码；
2. 文稿移动到 `999-未分类`；
3. YAML `status` 改为 `trashed`。

永久删除机制尚未实现。

## YAML 编辑

- `Ctrl+Y` 打开 YAML 编辑器
- 左侧为结构化表单，右侧为 YAML 源码
- 两侧双向同步；源码非法时保留上一次有效表单并禁用保存
- 缺少必填字段时显示问题提示，并阻止切换到其他文稿
- 编辑区顶部和预览模式共用 YAML 封面卡片

主要通用字段：

```yaml
id:
type:
template:
title:
created:
updated:
status:
tags: []
topics: []
summary:
related: []
milestones: []
needs_migration: false
```

## 双链

- 输入 `[[` 显示文稿联想菜单
- 上下键选择，Enter / Tab 插入
- 联想插入的是稳定 id，界面显示文稿当前标题
- 手写 `[[标题]]` 在目标可解析时自动保存为 `[[稳定 id]]`
- frontmatter 的 `related` 同步合并稳定 id
- 未能解析的未来链接保持原样

## Markdown 编辑能力

编辑器基于 CodeMirror 6。闭合后的块立即渲染，光标进入块内部时恢复源码。

- 标题、段落、列表、待办、引用、分割线
- Markdown 表格
- 代码围栏与 highlight.js
- Mermaid 图表（严格安全模式）
- `$...$` 与 `$$...$$` KaTeX 公式
- Callout：`NOTE / INFO / TIP / WARNING / ERROR / DANGER`
- 脚注
- 双链
- `==` 超级样式、上下标、圆圈和方框包裹
- `/` 超级斜杠菜单：表格尺寸、代码语言和常用块/样式

## 视图与焦点模式

- `Ctrl+1`：写作
- `Ctrl+2`：预览
- `Ctrl+3`：大纲
- `Ctrl+4`：导图
- `Ctrl+\`：显示或隐藏侧栏
- `Ctrl+.`：焦点模式

`Esc` 在无弹窗时循环：

```text
编辑模式 → 标签选择模式 → 管理模式 → 编辑模式
```

弹窗打开时，Esc 优先关闭当前弹窗或返回模板上一级，不会穿透触发模式切换。

## 常用快捷键

| 快捷键 | 功能 |
|---|---|
| `Alt+N` | 浏览器快速新建 |
| `Ctrl+N` | 快速新建（浏览器可能保留） |
| `Ctrl+Shift+E` | 结束本次写作 |
| `Ctrl+Y` | YAML 编辑器 |
| `Ctrl+K` | 插入 Markdown 链接 |
| `Ctrl+L` | 插入待办项 |
| `Ctrl+1/2/3/4` | 写作 / 预览 / 大纲 / 导图 |
| `Ctrl+\` | 侧栏 |
| `Ctrl+.` | 焦点模式 |
| `Esc` | 关闭弹窗或循环焦点模式 |
| `Menu` | 打开文件/文件夹上下文菜单 |

## 数据与备份

| 路径 | 用途 |
|---|---|
| `data/workspace.json` | 主工作区快照：目录、文稿、标签、主题和追踪状态 |
| `data/workspace.backup.json` | 上一次有效快照；主文件损坏时自动恢复 |
| `data/config.json` | 本地配置和明文超级密码，Git 忽略 |
| `localStorage['folio.workspace.v1']` | API 不可用时的浏览器缓存 |

工具栏“备份”导出完整 JSON，“导入”恢复目录、sheet id 和双链关系。单篇可导出 Markdown。

`workspace.json`、自动备份和 `config.json` 都已加入 `.gitignore`，不会随源码推送。换电脑请使用工作区备份文件或工具栏导出功能迁移数据。

## 项目结构

```text
markdown_editor/
├── 000-Template/               # 模板 Markdown 与目录说明书
├── data/                        # 本地工作区、自动备份与配置
├── docs/development-log.md      # 开发日志和设计决策
├── server/
│   ├── workspace.ts             # /api/workspace
│   └── config.ts                # /api/config
├── src/
│   ├── components/              # 侧栏、标签、工具栏、模板与工作流弹窗
│   ├── editor/                  # CodeMirror 扩展与交互
│   ├── lib/
│   │   ├── workspace-store.ts   # 工作区协调层
│   │   ├── workspace-folders.ts # 固定目录与迁移
│   │   ├── sheet-tracking.ts    # 指纹计算
│   │   ├── workspace-io.ts      # 快照规范化和版本
│   │   ├── wiki-scan.ts         # 双链扫描、解析与规范化
│   │   └── storage.ts           # API 与 localStorage
│   ├── App.tsx
│   └── types.ts
└── vite.config.ts
```

## 技术栈

- React 19
- TypeScript 6
- Vite 8
- CodeMirror 6
- KaTeX
- Mermaid
- highlight.js
- oxlint
- 自研 `useSyncExternalStore` 工作区状态

## 已知边界

- 当前运行形态是浏览器应用，尚未接入 Tauri/Electron 桌面壳。
- `Ctrl+N` 在多数浏览器中属于保留快捷键，请使用 `Alt+N` 或侧栏 `+`。
- 实体 Markdown 目录与虚拟 workspace 文件夹的双向同步尚未实现。
- 永久删除、插件系统、主题扩展和 AI 文稿迁移工具仍在规划阶段。
- `workspace-store.ts` 仍偏大；进一步拆分应在补齐自动化状态机测试后进行。

## 版本

当前版本：**1.4.1**。

- `v1.4.1`：ContextMenu 悬浮层修复 + 自动化测试套件（109 Vitest + 10 E2E）
- `v1.4.0`：PARA 文件组织、收集箱工作流、超级密码、软删除、指纹追踪、模板目录和稳定双链
- `v1.3.1`：CodeMirror block / 跨行 decoration 空白页修复
- `v1.3.0`：YAML 分栏编辑、YAML 卡片和 related 自动合并
- 更早版本见 Git tags
