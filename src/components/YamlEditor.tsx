import { useEffect, useMemo, useState } from 'react'
import { useWorkspace, workspace } from '../lib/workspace-store'
import { asString, asStringList, attrsFromYamlSource, splitFrontmatter, stringifyFrontmatter, type YamlValue } from '../lib/frontmatter'
import { applyField, fieldValue, fieldsForDoc, type YamlField } from '../lib/yaml-fields'
import { validateDoc } from '../lib/templates'
import { collectWikiRefs, resolveWikiRef } from '../lib/wiki-scan'
import { displayWiki } from '../editor/wiki'

const IDENTITY = new Set(['id', 'type', 'template', 'created', 'updated'])
const STORY = new Set(['title', 'status', 'tags', 'topics', 'summary', 'related', 'milestones'])

export function YamlEditor() {
  const { sheets, activeSheetId } = useWorkspace()
  const sheet = sheets.find((item) => item.id === activeSheetId)
  const parsed = useMemo(() => splitFrontmatter(sheet?.content ?? ''), [sheet?.content])
  const [source, setSource] = useState(() => (parsed.hasFence ? `---\n${parsed.raw}\n---\n` : stringifyFrontmatter(parsed.attrs)))
  const [attrs, setAttrs] = useState<Record<string, YamlValue>>(parsed.attrs)
  const [sourceError, setSourceError] = useState('')
  const templateId = asString(attrs.template) || asString(parsed.attrs.template)
  const fields = fieldsForDoc(attrs, templateId)
  const scanned = collectWikiRefs(parsed.body).map((ref) => resolveWikiRef(ref, sheets))
  const issues = validateDoc(attrs, parsed.body)
  const identity = fields.filter((field) => IDENTITY.has(field.key))
  const story = fields.filter((field) => STORY.has(field.key))
  const extra = fields.filter((field) => !IDENTITY.has(field.key) && !STORY.has(field.key))
  const blocked = Boolean(sourceError) || issues.length > 0

  useEffect(() => {
    setAttrs(parsed.attrs)
    setSource(parsed.hasFence ? `---\n${parsed.raw}\n---\n` : stringifyFrontmatter(parsed.attrs))
    setSourceError('')
  }, [sheet?.id, parsed.raw, parsed.attrs, parsed.hasFence])

  if (!sheet) return null

  const commitAttrs = (next: Record<string, YamlValue>) => {
    setAttrs(next)
    setSource(stringifyFrontmatter(next))
    setSourceError('')
  }

  const commitSource = (raw: string) => {
    setSource(raw)
    const result = attrsFromYamlSource(raw)
    if (result.ok) {
      setAttrs(result.attrs)
      setSourceError('')
      return
    }
    setSourceError(result.error)
  }

  const save = () => {
    const result = attrsFromYamlSource(source)
    if (!result.ok || validateDoc(result.attrs, parsed.body).length) return
    workspace.applyFrontmatter(sheet.id, result.attrs)
  }

  return (
    <div className="yaml-mask" onMouseDown={(event) => event.target === event.currentTarget && workspace.closeYamlEditor()}>
      <form
        className="yaml-dialog"
        onSubmit={(event) => {
          event.preventDefault()
          save()
        }}
      >
        <header>
          <div>
            <strong>元数据</strong>
            <span>{asString(attrs.title) || sheet.title}</span>
          </div>
          <em>{templateId || '未分类'} · {Object.keys(attrs).length} 项 · 左表单 / 右源码 · Ctrl+Y / Esc</em>
        </header>

        <div className="yaml-split">
          <div className="yaml-pane">
            <FieldSection title="身份" fields={identity} attrs={attrs} setAttrs={commitAttrs} />
            <FieldSection title="文稿" fields={story} attrs={attrs} setAttrs={commitAttrs} />
            {extra.length ? <FieldSection title="模板字段" fields={extra} attrs={attrs} setAttrs={commitAttrs} /> : null}
            {scanned.length ? (
              <section className="yaml-section">
                <h4>正文已引用 · 保存时并入 related</h4>
                <div className="yaml-card-related">
                  {scanned.map((ref) => (
                    <em key={ref}>{displayWiki(ref, sheets)}</em>
                  ))}
                </div>
              </section>
            ) : null}
          </div>

          <aside className="yaml-source">
            <h4>YAML 源码</h4>
            <textarea
              spellCheck={false}
              value={source}
              onChange={(event) => commitSource(event.target.value)}
              onKeyDown={(event) => event.stopPropagation()}
            />
            {sourceError ? <p className="yaml-source-error">{sourceError} · 改完后再同步表单</p> : <p>改这边会立刻改左边；改左边会重写这边</p>}
          </aside>
        </div>

        {issues.length ? (
          <div className="yaml-issues">
            {issues.map((issue) => (
              <p key={`${issue.field}-${issue.message}`}>
                <code>{issue.field}</code> {issue.message}
              </p>
            ))}
          </div>
        ) : null}
        <footer>
          <span>{asStringList(attrs.related).length} 条双链 · {asStringList(attrs.tags).length} 个标签</span>
          <div>
            <button type="button" className="text-btn" onClick={() => workspace.closeYamlEditor()}>
              取消
            </button>
            <button type="submit" className="primary-btn" disabled={blocked}>
              保存
            </button>
          </div>
        </footer>
      </form>
    </div>
  )
}

function FieldSection({
  title,
  fields,
  attrs,
  setAttrs,
}: {
  title: string
  fields: YamlField[]
  attrs: Record<string, YamlValue>
  setAttrs: (next: Record<string, YamlValue>) => void
}) {
  return (
    <section className="yaml-section">
      <h4>{title}</h4>
      <div className="yaml-grid">
        {fields.map((field) => (
          <label key={field.key} className={wide(field) ? 'is-wide' : ''}>
            <span>{field.label}</span>
            {field.kind === 'textarea' ? (
              <textarea
                value={fieldValue(attrs, field)}
                disabled={field.readonly}
                rows={3}
                onChange={(event) => setAttrs(applyField(attrs, field, event.target.value))}
              />
            ) : field.kind === 'bool' ? (
              <select
                value={fieldValue(attrs, field)}
                disabled={field.readonly}
                onChange={(event) => setAttrs(applyField(attrs, field, event.target.value))}
              >
                <option value="false">否</option>
                <option value="true">是</option>
              </select>
            ) : field.kind === 'select' ? (
              <select
                value={fieldValue(attrs, field)}
                disabled={field.readonly}
                onChange={(event) => setAttrs(applyField(attrs, field, event.target.value))}
              >
                {(field.options ?? []).map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            ) : (
              <input
                value={fieldValue(attrs, field)}
                disabled={field.readonly}
                type={field.kind === 'number' ? 'number' : 'text'}
                onChange={(event) => setAttrs(applyField(attrs, field, event.target.value))}
              />
            )}
          </label>
        ))}
      </div>
    </section>
  )
}

function wide(field: YamlField) {
  return field.kind === 'textarea' || field.kind === 'list' || field.key === 'title'
}
