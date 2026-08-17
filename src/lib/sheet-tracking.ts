import type { Sheet } from '../types'
import { splitFrontmatter, stringifyFrontmatter } from './frontmatter'

function canonicalSheet(sheet: Sheet): string {
  const doc = splitFrontmatter(sheet.content)
  if (!doc.hasFence) return `${sheet.title}\n${sheet.content}`
  const attrs = { ...doc.attrs }
  delete attrs.updated
  return `${sheet.title}\n${stringifyFrontmatter(attrs)}\n${doc.body}`
}

export async function fingerprintSheet(sheet: Sheet): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalSheet(sheet))
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}
