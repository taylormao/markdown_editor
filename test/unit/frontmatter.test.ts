import { describe, expect, it } from 'vitest'
import { asString, asStringList, compactStamp, makeReadableId, parseYamlMap, splitFrontmatter, stringifyFrontmatter, todayStamp } from '../../src/lib/frontmatter'

describe('splitFrontmatter', () => {
  it('解析带 frontmatter 的文稿', () => {
    const doc = splitFrontmatter('---\nid: abc\ntype: daily\ntitle: 晚间笔记\n---\n\n# 正文\n内容')
    expect(doc.hasFence).toBe(true)
    expect(doc.attrs.id).toBe('abc')
    expect(doc.attrs.type).toBe('daily')
    expect(doc.body).toContain('# 正文')
  })

  it('无 frontmatter 时返回空 attrs 和原文 body', () => {
    const doc = splitFrontmatter('# 只有标题\n内容')
    expect(doc.hasFence).toBe(false)
    expect(doc.attrs).toEqual({})
    expect(doc.body).toBe('# 只有标题\n内容')
  })

  it('CRLF 行尾被规范为 LF', () => {
    const doc = splitFrontmatter('---\r\nid: x\r\n---\r\n\r\n正文')
    expect(doc.attrs.id).toBe('x')
    expect(doc.body).toBe('正文')
  })

  it('缺少结束围栏时视为无 frontmatter', () => {
    const doc = splitFrontmatter('---\nid: x\n未闭合')
    expect(doc.hasFence).toBe(false)
  })
})

describe('parseYamlMap', () => {
  it('解析标量、布尔、null 与行内数组', () => {
    const attrs = parseYamlMap('a: 1\nb: true\nc: null\nd: [1, 2]\ne: hello\nf: [x, y]')
    expect(attrs.a).toBe(1)
    expect(attrs.b).toBe(true)
    expect(attrs.c).toBeNull()
    expect(attrs.d).toEqual([1, 2])
    expect(attrs.e).toBe('hello')
    expect(attrs.f).toEqual(['x', 'y'])
  })

  it('忽略注释与空行', () => {
    const attrs = parseYamlMap('# 注释\n\na: 1')
    expect(attrs.a).toBe(1)
  })
})

describe('stringifyFrontmatter', () => {
  it('往返序列化保持一致', () => {
    const original = '---\nid: abc\ntype: daily\ntags: [daily, 测试]\n---\n\n# 标题'
    const doc = splitFrontmatter(original)
    const rebuilt = stringifyFrontmatter(doc.attrs)
    const roundtrip = splitFrontmatter(`${rebuilt}\n${doc.body}`)
    expect(roundtrip.attrs).toEqual(doc.attrs)
  })

  it('空数组输出 []，含特殊字符的字符串加引号', () => {
    const out = stringifyFrontmatter({ tags: [], title: '含:冒号' })
    expect(out).toContain('tags: []')
    expect(out).toContain('title: "含:冒号"')
  })
})

describe('todayStamp / compactStamp / makeReadableId', () => {
  it('todayStamp 输出 YYYY-MM-DD', () => {
    const stamp = todayStamp(new Date(2024, 0, 5))
    expect(stamp).toBe('2024-01-05')
  })

  it('compactStamp 输出 YYYYMMDD', () => {
    expect(compactStamp(new Date(2024, 0, 5))).toBe('20240105')
  })

  it('makeReadableId 生成 {date}-{type}-{4位随机}', () => {
    const id = makeReadableId('daily', new Date(2024, 0, 5))
    expect(id).toMatch(/^20240105-daily-[a-z0-9]{4}$/)
  })
})

describe('asString / asStringList', () => {
  it('asString 转换标量并忽略对象', () => {
    expect(asString('x')).toBe('x')
    expect(asString(1)).toBe('1')
    expect(asString(true)).toBe('true')
    expect(asString(null)).toBe('')
    expect(asString(undefined)).toBe('')
    expect(asString({ a: 1 })).toBe('')
  })

  it('asStringList 展开数组并过滤空值', () => {
    expect(asStringList(['a', 'b', ''])).toEqual(['a', 'b'])
    expect(asStringList('single')).toEqual(['single'])
    expect(asStringList(null)).toEqual([])
  })
})
