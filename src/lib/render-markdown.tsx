import type { CSSProperties, ReactNode } from 'react'
import { circledGlyph, parseFlags, safeColor, wrapClass, type SuperFlags } from '../editor/super-syntax'
import { CodeBlock } from '../components/CodeBlock'
import { MermaidBlock } from '../components/MermaidBlock'
import { renderMath } from './math'
import { displayWiki } from '../editor/wiki'
import { workspace } from './workspace-store'

type Block =
  | { type: 'heading'; level: number; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'quote'; kind?: string; lines: string[] }
  | { type: 'code'; lang: string; text: string }
  | { type: 'list'; ordered: boolean; items: { task?: boolean; checked?: boolean; text: string }[] }
  | { type: 'table'; headers: string[]; rows: string[][] }
  | { type: 'hr' }
  | { type: 'footnote'; id: string; text: string }
  | { type: 'math'; text: string }

const SUPER_RE = /==(?:\[([^\]]*)\]((?:(?!==).)*?)|up((?:(?!==).)*?)|down((?:(?!==).)*?))==/g
const CALLOUT_RE = /^\[!(NOTE|INFO|TIP|WARNING|ERROR|DANGER)\]\s*/i

function applyStyle(flags: SuperFlags): CSSProperties {
  const style: CSSProperties = {}
  if (flags.bold) style.fontWeight = 700
  if (flags.italic) style.fontStyle = 'italic'
  if (flags.strike) style.textDecoration = 'line-through'
  if (flags.color && safeColor(flags.color)) style.color = flags.color
  if (flags.bg && safeColor(flags.bg)) {
    style.background = flags.bg
    style.borderRadius = flags.wrap === 'yuan' ? 999 : 4
    style.padding = flags.wrap ? 0 : '0 0.22em'
  }
  return style
}

function renderInline(text: string, keyPrefix = 'i', onWiki?: (title: string) => void): ReactNode[] {
  const nodes: ReactNode[] = []
  const tokens = tokenizeInline(text)
  tokens.forEach((token, index) => {
    const key = `${keyPrefix}-${index}`
    if (token.kind === 'text') nodes.push(<span key={key}>{token.value}</span>)
    else if (token.kind === 'code') nodes.push(<code key={key}>{token.value}</code>)
    else if (token.kind === 'super') {
      const label = token.flags.wrap === 'yuan' ? circledGlyph(token.value) ?? token.value : token.value
      nodes.push(
        <span key={key} className={['super-style', wrapClass(token.flags)].filter(Boolean).join(' ')} style={applyStyle(token.flags)}>
          {label}
        </span>,
      )
    } else if (token.kind === 'up') nodes.push(<sup key={key}>{token.value}</sup>)
    else if (token.kind === 'down') nodes.push(<sub key={key}>{token.value}</sub>)
    else if (token.kind === 'link') {
      nodes.push(
        <a key={key} href={token.href} target="_blank" rel="noreferrer">
          {renderInline(token.value, `${key}-`, onWiki)}
        </a>,
      )
    } else if (token.kind === 'image') {
      nodes.push(<img key={key} src={token.href} alt={token.value} />)
    }     else if (token.kind === 'strong') nodes.push(<strong key={key}>{renderInline(token.value, `${key}-`, onWiki)}</strong>)
    else if (token.kind === 'em') nodes.push(<em key={key}>{renderInline(token.value, `${key}-`, onWiki)}</em>)
    else if (token.kind === 'strike') nodes.push(<del key={key}>{renderInline(token.value, `${key}-`, onWiki)}</del>)
    else if (token.kind === 'wiki') {
      nodes.push(
        <button key={key} type="button" className="wiki-chip" onClick={() => onWiki?.(token.value)}>
          {displayWiki(token.value, workspace.get().sheets)}
        </button>,
      )
    } else if (token.kind === 'math') {
      nodes.push(<span key={key} className="math-inline" dangerouslySetInnerHTML={{ __html: renderMath(token.value) }} />)
    } else if (token.kind === 'fn') {
      nodes.push(
        <a key={key} className="fn-ref" href={`#fn-${token.value}`}>
          {token.value}
        </a>,
      )
    }
  })
  return nodes
}

type InlineToken =
  | { kind: 'text'; value: string }
  | { kind: 'code'; value: string }
  | { kind: 'super'; value: string; flags: SuperFlags }
  | { kind: 'up' | 'down'; value: string }
  | { kind: 'link' | 'image'; value: string; href: string }
  | { kind: 'strong' | 'em' | 'strike'; value: string }
  | { kind: 'fn'; value: string }
  | { kind: 'math'; value: string }
  | { kind: 'wiki'; value: string }

function tokenizeInline(input: string): InlineToken[] {
  const out: InlineToken[] = []
  let rest = input

  const take = (re: RegExp, map: (match: RegExpExecArray) => InlineToken | null): boolean => {
    const match = re.exec(rest)
    if (!match || match.index !== 0) return false
    const token = map(match)
    if (!token) return false
    out.push(token)
    rest = rest.slice(match[0].length)
    return true
  }

  while (rest.length) {
    if (take(/^`([^`]+)`/, (m) => ({ kind: 'code', value: m[1] }))) continue
    if (take(/^\$([^$\n]+?)\$/, (m) => ({ kind: 'math', value: m[1] }))) continue
    SUPER_RE.lastIndex = 0
    const superMatch = SUPER_RE.exec(rest)
    if (superMatch && superMatch.index === 0) {
      if (superMatch[1] != null) out.push({ kind: 'super', value: superMatch[2] ?? '', flags: parseFlags(superMatch[1]) })
      else if (superMatch[3] != null) out.push({ kind: 'up', value: superMatch[3] })
      else out.push({ kind: 'down', value: superMatch[4] ?? '' })
      rest = rest.slice(superMatch[0].length)
      continue
    }
    if (take(/^\[\[([^[\]]+)\]\]/, (m) => ({ kind: 'wiki', value: m[1] }))) continue
    if (take(/^!\[([^\]]*)\]\(([^)\s]+)\)/, (m) => ({ kind: 'image', value: m[1], href: m[2] }))) continue
    if (take(/^\[([^\]]+)\]\(([^)\s]+)\)/, (m) => ({ kind: 'link', value: m[1], href: m[2] }))) continue
    if (take(/^\[\^([^\]]+)\]/, (m) => ({ kind: 'fn', value: m[1] }))) continue
    if (take(/^\*\*([^*]+)\*\*/, (m) => ({ kind: 'strong', value: m[1] }))) continue
    if (take(/^__([^_]+)__/, (m) => ({ kind: 'strong', value: m[1] }))) continue
    if (take(/^~~([^~]+)~~/, (m) => ({ kind: 'strike', value: m[1] }))) continue
    if (take(/^\*([^*]+)\*/, (m) => ({ kind: 'em', value: m[1] }))) continue
    if (take(/^_([^_]+)_/, (m) => ({ kind: 'em', value: m[1] }))) continue

    const next = rest.search(/`|\$|==|!\[|\[\[|\[|\*\*|__|~~|\*|_/)
    if (next < 0) {
      out.push({ kind: 'text', value: rest })
      break
    }
    if (next === 0) {
      out.push({ kind: 'text', value: rest[0] })
      rest = rest.slice(1)
    } else {
      out.push({ kind: 'text', value: rest.slice(0, next) })
      rest = rest.slice(next)
    }
  }
  return out
}

function splitCells(line: string): string[] {
  return line
    .trim()
    .replace(/^\||\|$/g, '')
    .split('|')
    .map((cell) => cell.trim())
}

function isSepRow(line: string): boolean {
  return /^\s*\|?(\s*:?-{3,}:?\s*\|)+\s*:?-{3,}:?\s*\|?\s*$/.test(line)
}

function parseBlocks(markdown: string): Block[] {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n')
  const blocks: Block[] = []
  let i = 0

  const flushPara = (buf: string[]) => {
    const text = buf.join('\n').trim()
    if (text) blocks.push({ type: 'paragraph', text })
    buf.length = 0
  }

  while (i < lines.length) {
    const line = lines[i]
    if (!line.trim()) {
      i += 1
      continue
    }

    const mathLine = line.trim()
    if (mathLine.startsWith('$$')) {
      if (mathLine.length > 2 && mathLine.endsWith('$$')) {
        blocks.push({ type: 'math', text: mathLine.slice(2, -2).trim() })
        i += 1
        continue
      }
      const body: string[] = []
      if (mathLine.length > 2) body.push(mathLine.slice(2))
      i += 1
      while (i < lines.length && !lines[i].includes('$$')) {
        body.push(lines[i])
        i += 1
      }
      if (i < lines.length) {
        const tail = lines[i].replace('$$', '').trim()
        if (tail) body.push(tail)
        i += 1
      }
      blocks.push({ type: 'math', text: body.join('\n').trim() })
      continue
    }

    if (/^```/.test(line)) {
      const lang = line.replace(/^```/, '').trim()
      const body: string[] = []
      i += 1
      while (i < lines.length && !/^```/.test(lines[i])) {
        body.push(lines[i])
        i += 1
      }
      i += 1
      blocks.push({ type: 'code', lang, text: body.join('\n') })
      continue
    }

    if (/^---+$|^\*\*\*+$|^___+$/.test(line.trim())) {
      blocks.push({ type: 'hr' })
      i += 1
      continue
    }

    const heading = /^(#{1,6})\s+(.+)$/.exec(line)
    if (heading) {
      blocks.push({ type: 'heading', level: heading[1].length, text: heading[2] })
      i += 1
      continue
    }

    const fn = /^\[\^([^\]]+)\]:\s*(.+)$/.exec(line)
    if (fn) {
      blocks.push({ type: 'footnote', id: fn[1], text: fn[2] })
      i += 1
      continue
    }

    if (line.includes('|') && i + 1 < lines.length && isSepRow(lines[i + 1])) {
      const headers = splitCells(line)
      i += 2
      const rows: string[][] = []
      while (i < lines.length && lines[i].includes('|') && lines[i].trim()) {
        rows.push(splitCells(lines[i]))
        i += 1
      }
      blocks.push({ type: 'table', headers, rows })
      continue
    }

    if (/^>\s?/.test(line)) {
      const raw: string[] = []
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        raw.push(lines[i].replace(/^>\s?/, ''))
        i += 1
      }
      const first = raw[0] ?? ''
      const callout = CALLOUT_RE.exec(first)
      if (callout) {
        raw[0] = first.slice(callout[0].length)
        blocks.push({ type: 'quote', kind: callout[1].toUpperCase(), lines: raw })
      } else {
        blocks.push({ type: 'quote', lines: raw })
      }
      continue
    }

    if (/^\s*(?:[-*+]|\d+\.)\s+/.test(line)) {
      const ordered = /^\s*\d+\.\s+/.test(line)
      const items: { task?: boolean; checked?: boolean; text: string }[] = []
      while (i < lines.length && /^\s*(?:[-*+]|\d+\.)\s+/.test(lines[i])) {
        const item = lines[i].replace(/^\s*(?:[-*+]|\d+\.)\s+/, '')
        const task = /^\[([ xX])\]\s+/.exec(item)
        if (task) items.push({ task: true, checked: task[1] !== ' ', text: item.slice(task[0].length) })
        else items.push({ text: item })
        i += 1
      }
      blocks.push({ type: 'list', ordered, items })
      continue
    }

    const para: string[] = [line]
    i += 1
    while (i < lines.length && lines[i].trim() && !/^(#{1,6}\s|```|>\s?|---+$|\[\^[^\]]+\]:|\s*(?:[-*+]|\d+\.)\s+)/.test(lines[i])) {
      if (lines[i].includes('|') && i + 1 < lines.length && isSepRow(lines[i + 1])) break
      para.push(lines[i])
      i += 1
    }
    flushPara(para)
  }

  return blocks
}

function Heading({ level, children }: { level: number; children: ReactNode }) {
  if (level === 1) return <h1>{children}</h1>
  if (level === 2) return <h2>{children}</h2>
  if (level === 3) return <h3>{children}</h3>
  if (level === 4) return <h4>{children}</h4>
  if (level === 5) return <h5>{children}</h5>
  return <h6>{children}</h6>
}

const CALLOUT_LABEL: Record<string, string> = {
  NOTE: '注意',
  INFO: '消息',
  TIP: '提示',
  WARNING: '警告',
  ERROR: '错误',
  DANGER: '危险',
}

export function MarkdownPreview({ content, onWikiClick }: { content: string; onWikiClick?: (title: string) => void }) {
  const blocks = parseBlocks(content)
  const inline = (text: string, key: string) => renderInline(text, key, onWikiClick)

  if (!content.trim()) {
    return <div className="empty-stage">这篇还是空白，切回写作写上几句。</div>
  }

  return (
    <article className="preview-stage">
      {blocks.map((block, index) => {
        const key = `b-${index}`
        if (block.type === 'heading') {
          return (
            <Heading key={key} level={block.level}>
              {inline(block.text, key)}
            </Heading>
          )
        }
        if (block.type === 'paragraph') return <p key={key}>{inline(block.text, key)}</p>
        if (block.type === 'math') {
          return <div key={key} className="math-block" dangerouslySetInnerHTML={{ __html: renderMath(block.text, true) }} />
        }
        if (block.type === 'hr') return <hr key={key} />
        if (block.type === 'code') {
          if (block.lang.toLowerCase() === 'mermaid') {
            return <MermaidBlock key={key} source={block.text} />
          }
          return <CodeBlock key={key} lang={block.lang} code={block.text} />
        }
        if (block.type === 'list') {
          const List = block.ordered ? 'ol' : 'ul'
          return (
            <List key={key}>
              {block.items.map((item, itemIndex) => (
                <li key={`${key}-${itemIndex}`} className={item.task ? 'task' : undefined}>
                  {item.task ? <input type="checkbox" checked={item.checked} readOnly /> : null}
                  {inline(item.text, `${key}-${itemIndex}`)}
                </li>
              ))}
            </List>
          )
        }
        if (block.type === 'table') {
          return (
            <div key={key} className="preview-table">
              <table>
                <thead>
                  <tr>
                    {block.headers.map((cell, cellIndex) => (
                      <th key={cellIndex}>{inline(cell, `${key}-h${cellIndex}`)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {block.rows.map((row, rowIndex) => (
                    <tr key={rowIndex}>
                      {row.map((cell, cellIndex) => (
                        <td key={cellIndex}>{inline(cell, `${key}-r${rowIndex}-${cellIndex}`)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        }
        if (block.type === 'quote') {
          const kind = block.kind?.toLowerCase()
          return (
            <blockquote key={key} className={kind ? `callout callout-${kind}` : undefined}>
              {block.kind ? <div className="callout-label">{CALLOUT_LABEL[block.kind] ?? block.kind}</div> : null}
              {block.lines
                .filter((line) => line.trim().length > 0)
                .map((line, lineIndex) => (
                  <p key={lineIndex}>{inline(line, `${key}-${lineIndex}`)}</p>
                ))}
            </blockquote>
          )
        }
        return (
          <p key={key} id={`fn-${block.id}`} className="fn-def">
            <sup>{block.id}</sup> {inline(block.text, key)}
          </p>
        )
      })}
    </article>
  )
}
