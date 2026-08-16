import { asString, splitFrontmatter } from './frontmatter'

const WIKI = /\[\[([^[\]]+)\]\]/g

export function collectWikiRefs(body: string): string[] {
  const seen = new Set<string>()
  const refs: string[] = []
  WIKI.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = WIKI.exec(body))) {
    const ref = match[1].trim()
    if (!ref || seen.has(ref)) continue
    seen.add(ref)
    refs.push(ref)
  }
  return refs
}

export function resolveWikiRef(ref: string, sheets: { id: string; title: string; content: string }[]): string {
  const needle = ref.trim()
  if (!needle) return needle
  for (const sheet of sheets) {
    const id = asString(splitFrontmatter(sheet.content).attrs.id) || sheet.id
    if (id === needle || sheet.id === needle) return id
  }
  const byTitle = sheets.find((sheet) => sheet.title.trim().toLowerCase() === needle.toLowerCase())
  if (!byTitle) return needle
  return asString(splitFrontmatter(byTitle.content).attrs.id) || byTitle.id
}

export function mergeRelated(existing: unknown, scanned: string[]): string[] {
  const keep = Array.isArray(existing)
    ? existing.map((item) => String(item).trim()).filter(Boolean)
    : String(existing ?? '')
        .split(/[,，]/)
        .map((item) => item.trim())
        .filter(Boolean)
  const seen = new Set(keep)
  scanned.forEach((ref) => {
    if (seen.has(ref)) return
    seen.add(ref)
    keep.push(ref)
  })
  return keep
}
