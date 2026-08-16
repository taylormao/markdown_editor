import { asString, asStringList, makeReadableId, todayStamp, type YamlValue } from './frontmatter'

export type DocType =
  | 'spark'
  | 'daily'
  | 'review'
  | 'video'
  | 'literature'
  | 'tutorial'
  | 'clip'
  | 'project'
  | 'meeting'

export type TemplateId =
  | 'spark'
  | 'daily'
  | 'review'
  | 'video-episode'
  | 'video-series'
  | 'literature'
  | 'tutorial-note'
  | 'tutorial-publish'
  | 'clip'
  | 'project'
  | 'meeting'

export type TemplateDef = {
  id: TemplateId
  type: DocType
  title: string
  hint: string
  inbox?: boolean
}

export const templates: TemplateDef[] = [
  { id: 'spark', type: 'spark', title: '念头', hint: '三十秒捕捉，进收集箱', inbox: true },
  { id: 'daily', type: 'daily', title: '晚间笔记', hint: '一天一篇，可补昨天' },
  { id: 'review', type: 'review', title: '周回顾', hint: '拉七日数字，只写定性' },
  { id: 'video-episode', type: 'video', title: '视频笔记', hint: '一集一卡，保留时间戳' },
  { id: 'video-series', type: 'video', title: '视频系列', hint: '目录页，挂多集双链' },
  { id: 'literature', type: 'literature', title: '读书 / 长文', hint: '主张、摘录、反驳' },
  { id: 'tutorial-note', type: 'tutorial', title: '教程备忘', hint: '自己的短技巧，可私' },
  { id: 'tutorial-publish', type: 'tutorial', title: '教程成稿', hint: '给别人照着做的步骤' },
  { id: 'clip', type: 'clip', title: '收藏', hint: '别人的，必写为什么和下次' },
  { id: 'project', type: 'project', title: '项目', hint: '状态和下一步' },
  { id: 'meeting', type: 'meeting', title: '会议', hint: '决议与待办' },
]

export function templateById(id: string): TemplateDef | undefined {
  return templates.find((item) => item.id === id)
}

export function buildTemplateContent(template: TemplateDef, folderHint = ''): string {
  const now = new Date()
  const id = makeReadableId(template.type, now)
  const date = todayStamp(now)
  const title = defaultTitle(template, date)
  const common = {
    id,
    type: template.type,
    template: template.id,
    title,
    created: date,
    updated: date,
    status: template.inbox ? 'inbox' : 'brewing',
    tags: template.id === 'spark' ? [] : [template.type],
    topics: [] as string[],
    summary: '',
    related: [] as string[],
    milestones: [] as YamlValue[],
    needs_migration: false,
  }

  const extra = extraFields(template, date)
  const yaml = stringifySimple({ ...common, ...extra })
  return `---\n${yaml}---\n\n# ${title}\n\n${bodyStub(template, folderHint)}`
}

function defaultTitle(template: TemplateDef, date: string): string {
  if (template.id === 'daily') return `${date} 晚间`
  if (template.id === 'review') return `${date} 周回顾`
  if (template.id === 'spark') return '一个念头'
  return `未命名${template.title}`
}

function extraFields(template: TemplateDef, date: string): Record<string, YamlValue> {
  if (template.id === 'daily') {
    return {
      date,
      backfilled: false,
      pride: '',
      focus_min: 0,
      waste_min: 0,
      sessions: 1,
      longest_min: 0,
      planned: 0,
      done: 0,
      extra: 0,
      steps: 0,
      kcal: 0,
      weight: '',
      money_in: '',
      money_out: '',
      tasks: [],
    }
  }
  if (template.id === 'review') {
    return {
      week_of: date,
      pride: '',
      waste: '',
      next_three: [],
    }
  }
  if (template.id === 'video-episode') {
    return { source_url: '', source_path: '', duration: '', series: '' }
  }
  if (template.id === 'video-series') {
    return { episodes: [], progress: 0 }
  }
  if (template.id === 'literature') {
    return { source: '', claim: '' }
  }
  if (template.id === 'clip') {
    return { source: '', why: '', next: '' }
  }
  if (template.id === 'project') {
    return { next: '', backlog: [] }
  }
  if (template.id === 'meeting') {
    return { attendees: [], decisions: [] }
  }
  return {}
}

function bodyStub(template: TemplateDef, _folderHint: string): string {
  if (template.id === 'daily') {
    return `## 0. 今天最骄傲

## 工作

## 健康与关系

## 明日
`
  }
  if (template.id === 'review') {
    return `## 本周最骄傲

## 本周最浪费

## 下周只做三件事

1. 
2. 
3. 
`
  }
  if (template.id === 'video-episode') {
    return `### [00:00:00]()

`
  }
  if (template.id === 'spark') return '写下这个念头。\n'
  return ''
}

function stringifySimple(attrs: Record<string, YamlValue>): string {
  return Object.entries(attrs)
    .map(([key, value]) => {
      if (Array.isArray(value)) {
        if (value.length === 0) return `${key}: []\n`
        if (value.every((item) => typeof item !== 'object' || item === null)) {
          return `${key}: [${value.map((item) => String(item)).join(', ')}]\n`
        }
        return `${key}: []\n`
      }
      if (value === null) return `${key}:\n`
      if (typeof value === 'string') {
        return `${key}: ${value.includes(':') || value.includes('#') ? JSON.stringify(value) : value}\n`
      }
      return `${key}: ${String(value)}\n`
    })
    .join('')
}

export type ValidationIssue = { field: string; message: string }

export function validateDoc(attrs: Record<string, YamlValue>, body: string): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const type = asString(attrs.type)
  const template = asString(attrs.template)
  if (!asString(attrs.id)) issues.push({ field: 'id', message: '缺少稳定 id' })
  if (!type) issues.push({ field: 'type', message: '缺少 type' })
  if (!template) issues.push({ field: 'template', message: '缺少 template' })
  if (!asString(attrs.title)) issues.push({ field: 'title', message: '标题不能空' })
  if (!asString(attrs.created)) issues.push({ field: 'created', message: '缺少 created' })

  if (template === 'spark') {
    if (!body.trim()) issues.push({ field: 'body', message: '念头正文不能空' })
    if (!asStringList(attrs.tags).length) issues.push({ field: 'tags', message: '念头至少要有一个 tag' })
  }
  if (template === 'daily') {
    if (!asString(attrs.date)) issues.push({ field: 'date', message: '晚间笔记必须有 date' })
    if (!asString(attrs.pride) && !/## 0\./.test(body)) {
      issues.push({ field: 'pride', message: '必须写下今天最骄傲的事（YAML pride 或正文第 0 条）' })
    }
  }
  if (template === 'review') {
    if (!asString(attrs.pride) && !body.includes('最骄傲')) issues.push({ field: 'pride', message: '周回顾必须写最骄傲' })
    if (!asString(attrs.waste) && !body.includes('最浪费')) issues.push({ field: 'waste', message: '周回顾必须写最浪费' })
    if (!asStringList(attrs.next_three).length && !body.includes('三件事')) {
      issues.push({ field: 'next_three', message: '周回顾必须写下周三件事' })
    }
  }
  if (template === 'video-episode') {
    if (!asString(attrs.source_url) && !asString(attrs.source_path)) {
      issues.push({ field: 'source_url', message: '视频笔记必须有 source_url 或 source_path' })
    }
    if (!asString(attrs.duration)) issues.push({ field: 'duration', message: '视频笔记必须有时长 duration' })
  }
  if (template === 'clip') {
    if (!asString(attrs.why)) issues.push({ field: 'why', message: '收藏必须写 why' })
    if (!asString(attrs.next)) issues.push({ field: 'next', message: '收藏必须写 next' })
  }
  if (template === 'project') {
    if (!asString(attrs.status)) issues.push({ field: 'status', message: '项目必须有 status' })
    if (!asString(attrs.next)) issues.push({ field: 'next', message: '项目必须有下一步 next' })
  }
  return issues
}

export function titleFromAttrs(attrs: Record<string, YamlValue>, fallback: string): string {
  return asString(attrs.title) || fallback
}
