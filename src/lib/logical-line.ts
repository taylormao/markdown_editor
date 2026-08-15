export type LogicalSpan = { from: number; to: number }

const headingRe = /^(#{1,6})\s+/
const listRe = /^\s*(?:[-*+]|\d+\.)\s+/
const quoteRe = /^>\s?/
const hrRe = /^(?:---|\*\*\*|___)\s*$/
const fenceRe = /^```/
const mathOpenRe = /^\$\$/
const imageOnlyRe = /^\s*!\[[^\]]*\]\([^)]+\)\s*$/
const linkOnlyRe = /^\s*\[[^\]]+\]\([^)]+\)\s*$/
const wikiOnlyRe = /^\s*\[\[[^[\]]+\]\]\s*$/

function isSepRow(line: string): boolean {
  return /^\s*\|?(\s*:?-{3,}:?\s*\|)+\s*:?-{3,}:?\s*\|?\s*$/.test(line)
}

function isSpecialStart(line: string): boolean {
  return (
    headingRe.test(line) ||
    listRe.test(line) ||
    quoteRe.test(line) ||
    hrRe.test(line) ||
    fenceRe.test(line) ||
    mathOpenRe.test(line.trim()) ||
    imageOnlyRe.test(line) ||
    linkOnlyRe.test(line) ||
    wikiOnlyRe.test(line)
  )
}

export function collectLogicalSpans(content: string): LogicalSpan[] {
  const raw = content.replace(/\r\n/g, '\n')
  if (!raw.length) return [{ from: 0, to: 0 }]

  const lines: { text: string; from: number; to: number }[] = []
  let offset = 0
  const parts = raw.split('\n')
  parts.forEach((text, index) => {
    const to = offset + text.length
    lines.push({ text, from: offset, to })
    offset = to + (index < parts.length - 1 ? 1 : 0)
  })

  const spans: LogicalSpan[] = []
  let i = 0

  const push = (from: number, to: number) => {
    spans.push({ from, to })
  }

  while (i < lines.length) {
    const line = lines[i]
    if (!line.text.trim()) {
      push(line.from, line.to)
      i += 1
      continue
    }

    if (fenceRe.test(line.text)) {
      const start = line.from
      i += 1
      while (i < lines.length && !fenceRe.test(lines[i].text)) i += 1
      if (i < lines.length) {
        push(start, lines[i].to)
        i += 1
      } else {
        push(start, lines[lines.length - 1].to)
      }
      continue
    }

    const mathLine = line.text.trim()
    if (mathLine.startsWith('$$')) {
      if (mathLine.length > 2 && mathLine.endsWith('$$')) {
        push(line.from, line.to)
        i += 1
        continue
      }
      const start = line.from
      i += 1
      while (i < lines.length && !lines[i].text.includes('$$')) i += 1
      if (i < lines.length) {
        push(start, lines[i].to)
        i += 1
      } else {
        push(start, lines[lines.length - 1].to)
      }
      continue
    }

    if (line.text.includes('|') && i + 1 < lines.length && isSepRow(lines[i + 1].text)) {
      const start = line.from
      i += 2
      while (i < lines.length && lines[i].text.includes('|') && lines[i].text.trim()) i += 1
      push(start, lines[i - 1].to)
      continue
    }

    if (headingRe.test(line.text) || hrRe.test(line.text) || listRe.test(line.text)) {
      push(line.from, line.to)
      i += 1
      continue
    }

    if (quoteRe.test(line.text)) {
      const start = line.from
      i += 1
      while (i < lines.length && quoteRe.test(lines[i].text)) i += 1
      push(start, lines[i - 1].to)
      continue
    }

    if (imageOnlyRe.test(line.text) || linkOnlyRe.test(line.text) || wikiOnlyRe.test(line.text)) {
      push(line.from, line.to)
      i += 1
      continue
    }

    const start = line.from
    i += 1
    while (i < lines.length && lines[i].text.trim() && !isSpecialStart(lines[i].text)) {
      if (lines[i].text.includes('|') && i + 1 < lines.length && isSepRow(lines[i + 1].text)) break
      i += 1
    }
    push(start, lines[i - 1].to)
  }

  return spans.length ? spans : [{ from: 0, to: raw.length }]
}

export function locateLogical(content: string, pos: number): { row: number; col: number } {
  const spans = collectLogicalSpans(content)
  const clamped = Math.max(0, Math.min(pos, content.replace(/\r\n/g, '\n').length))
  let index = spans.findIndex((span) => clamped >= span.from && clamped <= span.to)
  if (index < 0) index = spans.length - 1
  const span = spans[index]
  return { row: index + 1, col: clamped - span.from + 1 }
}
