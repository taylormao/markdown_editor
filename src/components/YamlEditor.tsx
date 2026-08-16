import { useEffect, useMemo, useState } from 'react'
import { useWorkspace, workspace } from '../lib/workspace-store'
import { asString, splitFrontmatter, type YamlValue } from '../lib/frontmatter'
import { applyField, fieldValue, fieldsForTemplate } from '../lib/yaml-fields'
import { validateDoc } from '../lib/templates'

export function YamlEditor() {
  const { sheets, activeSheetId } = useWorkspace()
  const sheet = sheets.find((item) => item.id === activeSheetId)
  const parsed = useMemo(() => splitFrontmatter(sheet?.content ?? ''), [sheet?.content])
  const [attrs, setAttrs] = useState<Record<string, YamlValue>>(parsed.attrs)
  const templateId = asString(attrs.template) || asString(parsed.attrs.template)
  const fields = fieldsForTemplate(templateId)
  const issues = validateDoc(attrs, parsed.body)

  useEffect(() => {
    setAttrs(parsed.attrs)
  }, [sheet?.id, parsed.raw, parsed.attrs])

  if (!sheet) return null

  const save = () => {
    const nextIssues = validateDoc(attrs, parsed.body)
    if (nextIssues.length) return
    workspace.applyFrontmatter(sheet.id, attrs)
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
          <strong>编辑 YAML</strong>
          <span>Ctrl+Y 打开 · Esc 关闭 · 保存后写回文稿</span>
        </header>
        <div className="yaml-grid">
          {fields.map((field) => (
            <label key={field.key} className={field.kind === 'textarea' ? 'is-wide' : ''}>
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
          <button type="button" className="text-btn" onClick={() => workspace.closeYamlEditor()}>
            取消
          </button>
          <button type="submit" className="primary-btn" disabled={issues.length > 0}>
            保存
          </button>
        </footer>
      </form>
    </div>
  )
}
