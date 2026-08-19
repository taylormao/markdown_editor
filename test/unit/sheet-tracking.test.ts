import { describe, expect, it } from 'vitest'
import type { Sheet } from '../../src/types'
import { fingerprintSheet } from '../../src/lib/sheet-tracking'

function makeSheet(id: string, title: string, content: string): Sheet {
  return { id, folderId: 'inbox', title, content, createdAt: 1, updatedAt: 1, starred: false }
}

describe('fingerprintSheet SHA-256 指纹', () => {
  it('相同内容产生相同指纹', async () => {
    const a = makeSheet('s1', '标题', '---\nid: s1\ntype: daily\n---\n\n正文')
    const b = makeSheet('s2', '标题', '---\nid: s1\ntype: daily\n---\n\n正文')
    expect(await fingerprintSheet(a)).toBe(await fingerprintSheet(b))
  })

  it('正文变化导致指纹变化', async () => {
    const a = makeSheet('s1', '标题', '---\nid: s1\ntype: daily\n---\n\n原正文')
    const b = makeSheet('s1', '标题', '---\nid: s1\ntype: daily\n---\n\n新正文')
    expect(await fingerprintSheet(a)).not.toBe(await fingerprintSheet(b))
  })

  it('指纹长度为 64 位十六进制', async () => {
    const fp = await fingerprintSheet(makeSheet('s1', '标题', '正文'))
    expect(fp).toMatch(/^[0-9a-f]{64}$/)
  })

  it('updated 字段变化不影响指纹（只追踪真实修改）', async () => {
    const a = makeSheet('s1', '标题', '---\nid: s1\ntype: daily\nupdated: 2024-01-01\n---\n\n正文')
    const b = makeSheet('s1', '标题', '---\nid: s1\ntype: daily\nupdated: 2024-01-02\n---\n\n正文')
    expect(await fingerprintSheet(a)).toBe(await fingerprintSheet(b))
  })

  it('无 frontmatter 的文稿按标题+原文计算', async () => {
    const a = makeSheet('s1', '标题', '没有围栏的正文')
    const b = makeSheet('s1', '标题', '没有围栏的正文')
    expect(await fingerprintSheet(a)).toBe(await fingerprintSheet(b))
  })
})