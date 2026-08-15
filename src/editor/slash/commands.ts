import type { EditorView } from '@codemirror/view'

export type SlashCommand = {
  id: string
  title: string
  hint: string
  aliases: string[]
  group: 'block' | 'mark' | 'heading'
  insert: (view: EditorView, from: number, to: number) => void
}

export type SlashSession = {
  from: number
  to: number
  query: string
  path: string[]
  left: number
  top: number
  mode: 'list' | 'table' | 'code'
}

function replaceRange(view: EditorView, from: number, to: number, text: string, cursor: number, selectLen = 0) {
  const pos = from + cursor
  view.dispatch({
    changes: { from, to, insert: text },
    selection: selectLen > 0 ? { anchor: pos, head: pos + selectLen } : { anchor: pos },
    userEvent: 'input.slash',
  })
  view.focus()
}

export function buildTable(rows: number, cols: number): string {
  const r = Math.max(2, Math.min(12, rows))
  const c = Math.max(1, Math.min(12, cols))
  const cells = (fill: string) => `| ${Array.from({ length: c }, () => fill).join(' | ')} |`
  const header = cells('  ')
  const sep = cells('---')
  const body = Array.from({ length: r - 1 }, () => cells('  ')).join('\n')
  return `${header}\n${sep}\n${body}\n`
}

export function insertTable(view: EditorView, from: number, to: number, rows: number, cols: number) {
  const text = buildTable(rows, cols)
  replaceRange(view, from, to, text, 2, 0)
}

function nextFootnote(doc: string): number {
  const nums = [...doc.matchAll(/\[\^(\d+)\]/g)].map((item) => Number(item[1]))
  return (nums.length ? Math.max(...nums) : 0) + 1
}

function wrapLine(prefix: string) {
  return (view: EditorView, from: number, to: number) => {
    replaceRange(view, from, to, prefix, prefix.length)
  }
}

function callout(kind: string, label: string) {
  return (view: EditorView, from: number, to: number) => {
    const text = `> [!${kind}]\n> ${label}`
    replaceRange(view, from, to, text, text.length - label.length, label.length)
  }
}

export const slashCommands: SlashCommand[] = [
  {
    id: 'table',
    title: '表格',
    hint: '先选行列',
    aliases: ['table', '表格', 'grid'],
    group: 'block',
    insert: () => undefined,
  },
  {
    id: 'code',
    title: '代码块',
    hint: '/code/语言',
    aliases: ['code', '代码', 'fence'],
    group: 'block',
    insert: () => undefined,
  },
  {
    id: 'mermaid',
    title: 'Mermaid 图',
    hint: '```mermaid',
    aliases: ['mermaid', 'flowchart', 'sequence', '图表', '流程图'],
    group: 'block',
    insert: (view, from, to) =>
      replaceRange(view, from, to, '```mermaid\nflowchart LR\n  A[开始] --> B[下一步]\n```', 21, 15),
  },
  {
    id: 'footnote',
    title: '脚注',
    hint: '[^1]',
    aliases: ['footnote', '脚注', 'fn'],
    group: 'block',
    insert: (view, from, to) => {
      const n = nextFootnote(view.state.doc.toString())
      const mark = `[^${n}]`
      const def = `[^${n}]: 脚注内容`
      view.dispatch({ changes: { from, to, insert: mark }, userEvent: 'input.slash' })
      const end = view.state.doc.length
      const gap = view.state.doc.sliceString(Math.max(0, end - 1), end) === '\n' ? '\n' : '\n\n'
      const insert = `${gap}${def}`
      const start = end + gap.length + def.length - 4
      view.dispatch({
        changes: { from: end, insert },
        selection: { anchor: start, head: end + insert.length },
        userEvent: 'input.slash',
      })
      view.focus()
    },
  },
  {
    id: 'quote',
    title: '引用',
    hint: '>',
    aliases: ['quote', '引用', 'blockquote'],
    group: 'block',
    insert: wrapLine('> '),
  },
  {
    id: 'note',
    title: '注意引用',
    hint: '[!NOTE]',
    aliases: ['note', '注意', 'callout'],
    group: 'block',
    insert: callout('NOTE', '注意'),
  },
  {
    id: 'info',
    title: '消息引用',
    hint: '[!INFO]',
    aliases: ['info', '消息', 'information'],
    group: 'block',
    insert: callout('INFO', '消息'),
  },
  {
    id: 'warning',
    title: '警告引用',
    hint: '[!WARNING]',
    aliases: ['warning', '警告', 'warn'],
    group: 'block',
    insert: callout('WARNING', '警告'),
  },
  {
    id: 'error',
    title: '错误引用',
    hint: '[!ERROR]',
    aliases: ['error', '错误'],
    group: 'block',
    insert: callout('ERROR', '错误'),
  },
  {
    id: 'danger',
    title: '危险引用',
    hint: '[!DANGER]',
    aliases: ['danger', '危险'],
    group: 'block',
    insert: callout('DANGER', '危险'),
  },
  {
    id: 'math',
    title: '行内公式',
    hint: '$...$',
    aliases: ['math', 'latex', 'tex', '公式', 'katex'],
    group: 'mark',
    insert: (view, from, to) => replaceRange(view, from, to, '$E=mc^2$', 1, 6),
  },
  {
    id: 'math-block',
    title: '独立公式',
    hint: '$$...$$',
    aliases: ['equation', 'display', '公式块'],
    group: 'block',
    insert: (view, from, to) => replaceRange(view, from, to, '$$\n\\int_a^b f(x)\\,dx\n$$', 3, 20),
  },
  {
    id: 'highlight',
    title: '高亮',
    hint: '==[-h]…==',
    aliases: ['highlight', '高亮', 'mark'],
    group: 'mark',
    insert: (view, from, to) => replaceRange(view, from, to, '==[-h]高亮==', 5, 2),
  },
  {
    id: 'yuan',
    title: '圆圈包裹',
    hint: '==[-yuan]==',
    aliases: ['yuan', '圆圈', 'circled'],
    group: 'mark',
    insert: (view, from, to) => replaceRange(view, from, to, '==[-yuan]5==', 8, 1),
  },
  {
    id: 'fang',
    title: '方框包裹',
    hint: '==[-fang]==',
    aliases: ['fang', '方框', 'kbd', '按键'],
    group: 'mark',
    insert: (view, from, to) => replaceRange(view, from, to, '==[-fang]CTRL==', 8, 4),
  },
  {
    id: 'style',
    title: '超级样式',
    hint: '==[-b -c=]…==',
    aliases: ['style', '样式', 'super', '颜色'],
    group: 'mark',
    insert: (view, from, to) => replaceRange(view, from, to, '==[-b -c=yellow -bgc=red]文字==', 26, 2),
  },
  {
    id: 'sup',
    title: '上标',
    hint: '==up==',
    aliases: ['sup', 'up', '上标', '平方'],
    group: 'mark',
    insert: (view, from, to) => replaceRange(view, from, to, '==up2==', 4, 1),
  },
  {
    id: 'sub',
    title: '下标',
    hint: '==down==',
    aliases: ['sub', 'down', '下标', '分子'],
    group: 'mark',
    insert: (view, from, to) => replaceRange(view, from, to, '==down2==', 6, 1),
  },
  {
    id: 'hr',
    title: '分割线',
    hint: '---',
    aliases: ['hr', '分割', 'divider'],
    group: 'block',
    insert: (view, from, to) => replaceRange(view, from, to, '---\n', 4),
  },
  {
    id: 'todo',
    title: '待办',
    hint: '- [ ]',
    aliases: ['todo', 'task', '待办', 'checkbox'],
    group: 'block',
    insert: wrapLine('- [ ] '),
  },
  {
    id: 'ul',
    title: '无序列表',
    hint: '-',
    aliases: ['ul', 'list', '列表'],
    group: 'block',
    insert: wrapLine('- '),
  },
  {
    id: 'ol',
    title: '有序列表',
    hint: '1.',
    aliases: ['ol', 'ordered', '数字'],
    group: 'block',
    insert: wrapLine('1. '),
  },
  {
    id: 'link',
    title: '链接',
    hint: '[]()',
    aliases: ['link', '链接', 'url'],
    group: 'mark',
    insert: (view, from, to) => replaceRange(view, from, to, '[链接文字](https://)', 1, 4),
  },
  {
    id: 'image',
    title: '图片',
    hint: '![]()',
    aliases: ['image', 'img', '图片'],
    group: 'mark',
    insert: (view, from, to) => replaceRange(view, from, to, '![说明](https://)', 2, 2),
  },
  {
    id: 'h1',
    title: '一级标题',
    hint: '#',
    aliases: ['h1', 'heading1', '标题1'],
    group: 'heading',
    insert: wrapLine('# '),
  },
  {
    id: 'h2',
    title: '二级标题',
    hint: '##',
    aliases: ['h2', 'heading2', '标题2'],
    group: 'heading',
    insert: wrapLine('## '),
  },
  {
    id: 'h3',
    title: '三级标题',
    hint: '###',
    aliases: ['h3', 'heading3', '标题3'],
    group: 'heading',
    insert: wrapLine('### '),
  },
  {
    id: 'h4',
    title: '四级标题',
    hint: '####',
    aliases: ['h4', 'heading4', '标题4'],
    group: 'heading',
    insert: wrapLine('#### '),
  },
  {
    id: 'h5',
    title: '五级标题',
    hint: '#####',
    aliases: ['h5', 'heading5', '标题5'],
    group: 'heading',
    insert: wrapLine('##### '),
  },
  {
    id: 'h6',
    title: '六级标题',
    hint: '######',
    aliases: ['h6', 'heading6', '标题6'],
    group: 'heading',
    insert: wrapLine('###### '),
  },
]

export function parseSlashQuery(raw: string): { path: string[]; query: string } {
  const parts = raw.split('/')
  const query = parts.pop() ?? ''
  return { path: parts.map((part) => part.trim()).filter(Boolean), query: query.trim() }
}

export function filterCommands(query: string): SlashCommand[] {
  const q = query.trim().toLowerCase()
  if (!q) return slashCommands
  return slashCommands.filter((item) => {
    const hay = `${item.title} ${item.id} ${item.hint} ${item.aliases.join(' ')}`.toLowerCase()
    return hay.includes(q)
  })
}

export function insertCodeFence(view: EditorView, from: number, to: number, fence: string) {
  const open = fence ? `\`\`\`${fence}\n` : '```\n'
  replaceRange(view, from, to, `${open}\n\`\`\``, open.length)
}

export function detectSlash(view: EditorView): Omit<SlashSession, 'mode'> | null {
  const { state } = view
  const main = state.selection.main
  if (!main.empty) return null
  const pos = main.head
  const line = state.doc.lineAt(pos)
  const before = line.text.slice(0, pos - line.from)
  const match = /(?:^|\s)\/([^\s]*)$/.exec(before)
  if (!match) return null

  const from = line.from + before.length - match[0].trimStart().length
  const raw = match[1]
  const { path, query } = parseSlashQuery(raw)
  const coords = view.coordsAtPos(from)
  if (!coords) return null
  const host = (view.dom.closest('.editor-host') ?? view.dom).getBoundingClientRect()
  return {
    from,
    to: pos,
    query,
    path,
    left: Math.min(Math.max(8, coords.left - host.left), host.width - 300),
    top: coords.bottom - host.top + 8,
  }
}
