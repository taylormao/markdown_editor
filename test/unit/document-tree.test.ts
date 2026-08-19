import { describe, expect, it } from 'vitest'
import { countWords, excerptFromContent, parseOutline, titleFromContent } from '../../src/lib/document-tree'

describe('parseOutline', () => {
  it('解析标题层级结构', () => {
    const markdown = '# 一级\n## 二级A\n## 二级B\n### 三级'
    const outline = parseOutline(markdown)
    expect(outline).toHaveLength(1)
    expect(outline[0].text).toBe('一级')
    expect(outline[0].children).toHaveLength(2)
    expect(outline[0].children[1].children).toHaveLength(1)
    expect(outline[0].children[1].children[0].text).toBe('三级')
  })

  it('列表项按缩进生成层级', () => {
    const markdown = '- 项目一\n  - 子项\n- 项目二'
    const outline = parseOutline(markdown)
    expect(outline).toHaveLength(2)
    expect(outline[0].children).toHaveLength(1)
  })

  it('行号从 1 开始', () => {
    const outline = parseOutline('# 标题')
    expect(outline[0].line).toBe(1)
  })

  it('忽略普通段落', () => {
    expect(parseOutline('普通段落没有标题')).toHaveLength(0)
  })
})

describe('titleFromContent', () => {
  it('优先使用 YAML title', () => {
    const content = '---\ntitle: YAML 标题\n---\n\n# 正文标题'
    expect(titleFromContent(content)).toBe('YAML 标题')
  })

  it('无 YAML 时使用第一个标题', () => {
    expect(titleFromContent('# 正文标题\n内容')).toBe('正文标题')
  })

  it('无标题时返回"未命名文稿"', () => {
    expect(titleFromContent('')).toBe('未命名文稿')
  })
})

describe('excerptFromContent', () => {
  it('提取正文第二到第四行作为摘要', () => {
    const content = '# 标题\n第一行\n第二行\n第三行\n第四行'
    expect(excerptFromContent(content)).toBe('第一行 第二行 第三行')
  })

  it('空正文返回"空白文稿"', () => {
    expect(excerptFromContent('')).toBe('空白文稿')
  })
})

describe('countWords', () => {
  it('统计字符与词数', () => {
    const stats = countWords('Hello world 你好')
    expect(stats.chars).toBeGreaterThan(0)
    expect(stats.words).toBeGreaterThan(0)
  })

  it('空内容返回零', () => {
    expect(countWords('')).toEqual({ chars: 0, words: 0 })
  })
})