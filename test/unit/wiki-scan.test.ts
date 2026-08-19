import { describe, expect, it } from 'vitest'
import { collectWikiRefs, mergeRelated, normalizeWikiRefs, resolveWikiRef } from '../../src/lib/wiki-scan'

type RefSheet = { id: string; title: string; content: string }

function sheet(id: string, title: string): RefSheet {
  return { id, title, content: `---\nid: ${id}\ntitle: ${title}\n---\n\n# ${title}` }
}

describe('collectWikiRefs', () => {
  it('收集正文中的双链引用并去重', () => {
    const body = '见 [[文稿A]] 和 [[文稿B]] 以及重复的 [[文稿A]]'
    expect(collectWikiRefs(body)).toEqual(['文稿A', '文稿B'])
  })

  it('忽略空引用', () => {
    expect(collectWikiRefs('[[ ]] 和 [[]]')).toEqual([])
  })

  it('没有双链时返回空数组', () => {
    expect(collectWikiRefs('普通文本')).toEqual([])
  })
})

describe('resolveWikiRef', () => {
  const sheets = [sheet('s1', '文稿A'), sheet('s2', '文稿B')]

  it('按稳定 id 解析', () => {
    expect(resolveWikiRef('s1', sheets)).toBe('s1')
  })

  it('按标题解析为稳定 id', () => {
    expect(resolveWikiRef('文稿B', sheets)).toBe('s2')
  })

  it('标题匹配忽略大小写与首尾空格', () => {
    expect(resolveWikiRef('  文稿a  ', sheets)).toBe('s1')
  })

  it('无法解析时原样返回', () => {
    expect(resolveWikiRef('不存在的文稿', sheets)).toBe('不存在的文稿')
  })

  it('空引用原样返回', () => {
    expect(resolveWikiRef('', sheets)).toBe('')
  })
})

describe('mergeRelated', () => {
  it('合并现有 related 与扫描到的引用并去重', () => {
    expect(mergeRelated(['a', 'b'], ['b', 'c'])).toEqual(['a', 'b', 'c'])
  })

  it('逗号分隔字符串也能解析为数组', () => {
    expect(mergeRelated('a,b', ['c'])).toEqual(['a', 'b', 'c'])
  })

  it('空值返回扫描结果', () => {
    expect(mergeRelated(undefined, ['c'])).toEqual(['c'])
    expect(mergeRelated(null, [])).toEqual([])
  })
})

describe('normalizeWikiRefs', () => {
  const sheets = [sheet('s1', '文稿A')]

  it('手写标题被规范为稳定 id', () => {
    const out = normalizeWikiRefs('链接 [[文稿A]] 结束', sheets)
    expect(out).toBe('链接 [[s1]] 结束')
  })

  it('已解析的稳定 id 保持不变', () => {
    const out = normalizeWikiRefs('链接 [[s1]] 结束', sheets)
    expect(out).toBe('链接 [[s1]] 结束')
  })

  it('未解析引用保持原样', () => {
    const out = normalizeWikiRefs('链接 [[未来文稿]] 结束', sheets)
    expect(out).toBe('链接 [[未来文稿]] 结束')
  })
})