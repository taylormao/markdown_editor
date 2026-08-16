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
  { key: 'created', label: '创建', kind: 'text', readonly: true },
  { key: 'updated', label: '更新', kind: 'text', readonly: true },
  { key: 'related', label: '相关双链（正文 [[ ]] 会自动并入）', kind: 'list' },
  { key: 'milestones', label: '阶段总结', kind: 'list' },
]

const LABELS: Record<string, string> = {
  id: 'id',
  type: '类型',
  template: '模板',
  title: '标题',
  status: '状态',
  tags: '标签',
  topics: '主题',
  summary: '摘要',
  created: '创建',
  updated: '更新',
  related: '相关双链',
  milestones: '阶段总结',
  date: '日期',
  backfilled: '补写',
  pride: '最骄傲',
  waste: '最浪费',
  focus_min: '专注分钟',
  waste_min: '浪费分钟',
  sessions: '工作段数',
  longest_min: '最长一段',
  planned: '计划任务',
  done: '完成任务',
  extra: '额外任务',
  steps: '步数',
  kcal: '卡路里',
  weight: '体重',
  money_in: '收入',
  money_out: '支出',
  tasks: '勾选任务',
  week_of: '周起始',
  next_three: '下周三件事',
  source_url: '视频链接',
  source_path: '本地路径',
  duration: '时长',
  series: '系列',
  episodes: '分集',
  progress: '进度',
  source: '出处',
  claim: '主张',
  why: '为什么藏',
  next: '下一步',
  attendees: '与会',
  decisions: '决议',
  backlog: '待办',
}

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
    { key: 'tasks', label: '勾选任务', kind: 'list' },
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
  project: [
    { key: 'next', label: '下一步', kind: 'textarea' },
    { key: 'backlog', label: '待办', kind: 'list' },
  ],
  meeting: [
    { key: 'attendees', label: '与会', kind: 'list' },
    { key: 'decisions', label: '决议', kind: 'list' },
  ],
}

export function fieldsForTemplate(templateId: string): YamlField[] {
  return [...COMMON, ...(BY_TEMPLATE[templateId] ?? [])]
}

export function fieldLabel(key: string): string {
  return LABELS[key] ?? key
}

function inferField(key: string, value: YamlValue): YamlField {
  if (Array.isArray(value)) return { key, label: fieldLabel(key), kind: 'list' }
  if (typeof value === 'boolean') return { key, label: fieldLabel(key), kind: 'bool' }
  if (typeof value === 'number') return { key, label: fieldLabel(key), kind: 'number' }
  if (typeof value === 'string' && (value.includes('\n') || value.length > 48)) {
    return { key, label: fieldLabel(key), kind: 'textarea' }
  }
  return { key, label: fieldLabel(key), kind: 'text' }
}

export function fieldsForDoc(attrs: Record<string, YamlValue>, templateId: string): YamlField[] {
  const base = fieldsForTemplate(templateId).map((field) => ({ ...field, label: fieldLabel(field.key) || field.label }))
  const seen = new Set(base.map((field) => field.key))
  const extra = Object.keys(attrs)
    .filter((key) => !seen.has(key) && key !== 'needs_migration')
    .map((key) => inferField(key, attrs[key]))
  return [...base, ...extra]
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
