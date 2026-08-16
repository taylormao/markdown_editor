import { asString, asStringList, type YamlValue } from './frontmatter'

export type FieldKind = 'text' | 'textarea' | 'number' | 'bool' | 'list' | 'select'

export type YamlField = {
  key: string
  label: string
  kind: FieldKind
  options?: string[]
  readonly?: boolean
}

const COMMON: YamlField[] = [
  { key: 'id', label: 'id', kind: 'text', readonly: true },
  { key: 'type', label: 'type', kind: 'text', readonly: true },
  { key: 'template', label: 'template', kind: 'text', readonly: true },
  { key: 'title', label: '标题', kind: 'text' },
  { key: 'status', label: '状态', kind: 'select', options: ['inbox', 'brewing', 'evergreen', 'archived', 'active', 'paused', 'done'] },
  { key: 'tags', label: 'tags', kind: 'list' },
  { key: 'topics', label: 'topics', kind: 'list' },
  { key: 'summary', label: '摘要', kind: 'textarea' },
  { key: 'related', label: '相关双链', kind: 'list' },
]

const BY_TEMPLATE: Record<string, YamlField[]> = {
  spark: [],
  daily: [
    { key: 'date', label: '日期', kind: 'text' },
    { key: 'backfilled', label: '补写', kind: 'bool' },
    { key: 'pride', label: '今天最骄傲', kind: 'textarea' },
    { key: 'focus_min', label: '专注分钟', kind: 'number' },
    { key: 'waste_min', label: '浪费分钟', kind: 'number' },
    { key: 'sessions', label: '工作段数', kind: 'number' },
    { key: 'longest_min', label: '最长一段', kind: 'number' },
    { key: 'planned', label: '计划任务数', kind: 'number' },
    { key: 'done', label: '完成任务数', kind: 'number' },
    { key: 'extra', label: '额外任务数', kind: 'number' },
    { key: 'steps', label: '步数', kind: 'number' },
    { key: 'kcal', label: '消耗卡路里', kind: 'number' },
    { key: 'weight', label: '体重', kind: 'text' },
    { key: 'money_in', label: '收入（可选）', kind: 'text' },
    { key: 'money_out', label: '支出（可选）', kind: 'text' },
  ],
  review: [
    { key: 'week_of', label: '周起始', kind: 'text' },
    { key: 'pride', label: '本周最骄傲', kind: 'textarea' },
    { key: 'waste', label: '本周最浪费', kind: 'textarea' },
    { key: 'next_three', label: '下周三件事', kind: 'list' },
  ],
  'video-episode': [
    { key: 'source_url', label: '视频链接', kind: 'text' },
    { key: 'source_path', label: '本地路径', kind: 'text' },
    { key: 'duration', label: '时长', kind: 'text' },
    { key: 'series', label: '系列 id', kind: 'text' },
  ],
  'video-series': [
    { key: 'episodes', label: '分集 id', kind: 'list' },
    { key: 'progress', label: '进度', kind: 'number' },
  ],
  literature: [
    { key: 'source', label: '出处', kind: 'text' },
    { key: 'claim', label: '主张', kind: 'textarea' },
  ],
  'tutorial-note': [],
  'tutorial-publish': [],
  clip: [
    { key: 'source', label: '来源', kind: 'text' },
    { key: 'why', label: '为什么藏', kind: 'textarea' },
    { key: 'next', label: '下次怎么用', kind: 'textarea' },
  ],
  project: [{ key: 'next', label: '下一步', kind: 'textarea' }],
  meeting: [
    { key: 'attendees', label: '与会', kind: 'list' },
    { key: 'decisions', label: '决议', kind: 'list' },
  ],
}

export function fieldsForTemplate(templateId: string): YamlField[] {
  return [...COMMON, ...(BY_TEMPLATE[templateId] ?? [])]
}

export function fieldValue(attrs: Record<string, YamlValue>, field: YamlField): string {
  const value = attrs[field.key]
  if (field.kind === 'list') return asStringList(value).join(', ')
  if (field.kind === 'bool') return asString(value) === 'true' ? 'true' : 'false'
  return asString(value)
}

export function applyField(attrs: Record<string, YamlValue>, field: YamlField, raw: string): Record<string, YamlValue> {
  const next = { ...attrs }
  if (field.kind === 'list') next[field.key] = raw.split(/[,，]/).map((item) => item.trim()).filter(Boolean)
  else if (field.kind === 'number') next[field.key] = raw.trim() === '' ? 0 : Number(raw)
  else if (field.kind === 'bool') next[field.key] = raw === 'true'
  else next[field.key] = raw
  return next
}
