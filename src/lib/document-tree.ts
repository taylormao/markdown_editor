import type { OutlineNode } from '../types'

const headingRe = /^(#{1,6})\s+(.+?)\s*$/
const listRe = /^(\s*)(?:[-*+]|\d+\.)\s+(.+?)\s*$/

export function parseOutline(markdown: string): OutlineNode[] {
  const roots: OutlineNode[] = []
  const stack: OutlineNode[] = []

  markdown.split('\n').forEach((raw, index) => {
    const heading = headingRe.exec(raw)
    const list = heading ? null : listRe.exec(raw)
    if (!heading && !list) return

    const level = heading ? heading[1].length : 6 + Math.min(4, Math.floor((list?.[1].length ?? 0) / 2))
    const text = (heading?.[2] ?? list?.[2] ?? '').replace(/[*_`]/g, '')
    const node: OutlineNode = {
      id: `n-${index}`,
      level,
      text,
      line: index + 1,
      children: [],
    }

    while (stack.length && stack[stack.length - 1].level >= level) stack.pop()
    if (stack.length) stack[stack.length - 1].children.push(node)
    else roots.push(node)
    stack.push(node)
  })

  return roots
}

export function titleFromContent(content: string): string {
  const line = content.split('\n').find((item) => item.trim().length > 0) ?? ''
  return line.replace(/^#+\s*/, '').replace(/[*_`]/g, '').trim() || '未命名文稿'
}

export function excerptFromContent(content: string): string {
  const lines = content
    .split('\n')
    .map((line) => line.replace(/^#+\s*/, '').replace(/[*_`>#-]/g, '').trim())
    .filter(Boolean)
  return lines.slice(1, 4).join(' ') || '空白文稿'
}

export function countWords(content: string): { chars: number; words: number } {
  const text = content.replace(/[#*_>`\-[\]()]/g, '')
  const chars = text.replace(/\s/g, '').length
  const words = text.trim() ? text.trim().split(/\s+/).length : 0
  return { chars, words }
}
