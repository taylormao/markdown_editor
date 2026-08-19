import { describe, expect, it } from 'vitest'
import { buildTemplateContent, templateById, templates, validateDoc } from '../../src/lib/templates'
import { splitFrontmatter } from '../../src/lib/frontmatter'

describe('templates 模板目录', () => {
  it('包含全部 9 个 type 和 11 个模板', () => {
    expect(templates).toHaveLength(11)
    const types = new Set(templates.map((t) => t.type))
    expect(types).toEqual(new Set(['spark', 'daily', 'review', 'video', 'literature', 'tutorial', 'clip', 'project', 'meeting']))
  })

  it('templateById 能查到每个模板', () => {
    for (const t of templates) {
      expect(templateById(t.id)?.id).toBe(t.id)
    }
    expect(templateById('不存在')).toBeUndefined()
  })

  it('spark 模板标记为 inbox（留在收集箱）', () => {
    expect(templateById('spark')?.inbox).toBe(true)
  })
})

describe('buildTemplateContent', () => {
  it('生成的文稿包含稳定 id、type、template 与 title', () => {
    const content = buildTemplateContent(templateById('daily')!)
    const doc = splitFrontmatter(content)
    expect(doc.attrs.id).toMatch(/^\d{8}-daily-[a-z0-9]{4}$/)
    expect(doc.attrs.type).toBe('daily')
    expect(doc.attrs.template).toBe('daily')
    expect(doc.attrs.status).toBe('brewing')
    expect(doc.attrs.created).toBe(doc.attrs.updated)
  })

  it('spark 模板 status 为 inbox 且标题为"一个念头"', () => {
    const content = buildTemplateContent(templateById('spark')!)
    const doc = splitFrontmatter(content)
    expect(doc.attrs.status).toBe('inbox')
    expect(doc.attrs.title).toBe('一个念头')
    expect(doc.body).toContain('写下这个念头')
  })

  it('daily 模板包含日期与专项字段', () => {
    const content = buildTemplateContent(templateById('daily')!)
    const doc = splitFrontmatter(content)
    expect(doc.attrs.date).toBeTruthy()
    expect(doc.attrs.tasks).toEqual([])
    expect(doc.body).toContain('今天最骄傲')
  })

  it('视频笔记模板需要 source 与 duration 字段', () => {
    const content = buildTemplateContent(templateById('video-episode')!)
    const doc = splitFrontmatter(content)
    expect(doc.attrs.source_url).toBe('')
    expect(doc.attrs.duration).toBe('')
  })
})

describe('validateDoc', () => {
  it('完整 daily 文稿通过校验', () => {
    const content = buildTemplateContent(templateById('daily')!)
    const doc = splitFrontmatter(content)
    const issues = validateDoc({ ...doc.attrs, pride: '今天完成测试' }, doc.body)
    expect(issues).toEqual([])
  })

  it('缺少必填字段时报错', () => {
    const issues = validateDoc({}, '')
    const fields = issues.map((i) => i.field)
    expect(fields).toContain('id')
    expect(fields).toContain('type')
    expect(fields).toContain('template')
    expect(fields).toContain('title')
    expect(fields).toContain('created')
  })

  it('spark 需要正文与 tag', () => {
    const content = buildTemplateContent(templateById('spark')!)
    const doc = splitFrontmatter(content)
    const issues = validateDoc({ ...doc.attrs, tags: [] }, '')
    expect(issues.map((i) => i.field)).toContain('body')
    expect(issues.map((i) => i.field)).toContain('tags')
  })

  it('daily 缺 date 或 pride 时报错', () => {
    const content = buildTemplateContent(templateById('daily')!)
    const doc = splitFrontmatter(content)
    const issues = validateDoc({ ...doc.attrs, date: '' }, '')
    expect(issues.map((i) => i.field)).toContain('date')
    expect(issues.map((i) => i.field)).toContain('pride')
  })

  it('project 需要 status 与 next', () => {
    const content = buildTemplateContent(templateById('project')!)
    const doc = splitFrontmatter(content)
    const issues = validateDoc({ ...doc.attrs, status: '', next: '' }, '')
    expect(issues.map((i) => i.field)).toContain('status')
    expect(issues.map((i) => i.field)).toContain('next')
  })

  it('clip 需要 why 与 next', () => {
    const content = buildTemplateContent(templateById('clip')!)
    const doc = splitFrontmatter(content)
    const issues = validateDoc({ ...doc.attrs, why: '', next: '' }, '')
    expect(issues.map((i) => i.field)).toContain('why')
    expect(issues.map((i) => i.field)).toContain('next')
  })

  it('视频笔记缺 source 与 duration 时报错', () => {
    const content = buildTemplateContent(templateById('video-episode')!)
    const doc = splitFrontmatter(content)
    const issues = validateDoc({ ...doc.attrs, source_url: '', source_path: '', duration: '' }, '')
    expect(issues.map((i) => i.field)).toContain('source_url')
    expect(issues.map((i) => i.field)).toContain('duration')
  })
})
