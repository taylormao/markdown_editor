import { uid } from './id'
import type { Folder, Sheet } from '../types'

const welcome = `# 把思想写成作品

Folio 是一间退让的书房。界面不抢视线，标记语法锁住格式，同一份文稿可以在写作、大纲和思维导图之间切换。

## 沉浸写作

高质量创作 = 时间 × 专注。工具栏默认隐去，焦点模式只留下文字。

- 输入 \`/\` 打开超级斜杠：表格、代码块、脚注、引用
- 用 \`==[-b -bgc=red -c=yellow]OK==\` 给文字上色
- 用 \`$E=mc^2$\` 或 \`$$\\int_a^b f(x)\\,dx$$\` 写公式
- 用 \`X==up2==\`、\`H==down2==O\` 写上下标
- \`Ctrl + \\\` 隐藏侧栏，进入焦点模式

## 整理逻辑

文字与大纲本是同一棵树。先列结构，再把段落填进去，不必在两套软件之间搬运思绪。

### 大纲

右侧切换到大纲，可以看见森林，也可以点进某一棵树。

### 思维导图

同一份层级，换一种看的方式。适合发散、重组、发现漏掉的分支。

## 退让设计

没有主色调，跟随系统外观。左侧毛玻璃托住文稿箱与卡片，右侧是最大的阅读宽度与行距。

> 软件应当退后一步，把舞台留给正在成形的句子。

开始写下一篇吧。不必先想好文件名——标题会从第一行长出来。
`

export function createSeed(): { folders: Folder[]; sheets: Sheet[] } {
  const inbox = uid()
  const drafts = uid()
  const now = Date.now()

  const folders: Folder[] = [
    { id: inbox, name: '收集箱', order: 0 },
    { id: drafts, name: '文稿', order: 1 },
  ]

  const sheets: Sheet[] = [
    {
      id: uid(),
      folderId: drafts,
      title: '把思想写成作品',
      content: welcome,
      createdAt: now - 86_400_000,
      updatedAt: now,
      starred: true,
    },
    {
      id: uid(),
      folderId: inbox,
      title: '一个尚未展开的念头',
      content: '路过窗口时想到的句子，先放在这里。',
      createdAt: now - 3_600_000,
      updatedAt: now - 3_600_000,
      starred: false,
    },
  ]

  return { folders, sheets }
}
