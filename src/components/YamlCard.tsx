import { asString, asStringList, type YamlValue } from '../lib/frontmatter'
import { fieldLabel } from '../lib/yaml-fields'
import { displayWiki } from '../editor/wiki'
import { workspace } from '../lib/workspace-store'

export function YamlCard({
  attrs,
  onWikiClick,
  onEdit,
}: {
  attrs: Record<string, YamlValue>
  onWikiClick?: (title: string) => void
  onEdit?: () => void
}) {
  const skip = new Set(['id', 'type', 'template', 'title', 'status', 'tags', 'topics', 'summary', 'related', 'needs_migration', 'created', 'updated'])
  const facts = Object.entries(attrs).filter(([key, value]) => !skip.has(key) && value !== '' && value != null && !(Array.isArray(value) && !value.length))
  const created = asString(attrs.created)
  const updated = asString(attrs.updated)
  return (
    <section className={`yaml-card${onEdit ? '' : ' is-preview'}`} onClick={onEdit}>
      <div className="yaml-card-kicker">
        <b>{asString(attrs.template) || asString(attrs.type) || '文稿'}</b>
        <i>{asString(attrs.status) || 'inbox'}</i>
      </div>
      <h3 className="yaml-card-title">{asString(attrs.title) || '未命名文稿'}</h3>
      <p className="yaml-card-meta">
        {[asString(attrs.id), created, updated && updated !== created ? `更新 ${updated}` : ''].filter(Boolean).join(' · ')}
      </p>
      <div className="yaml-card-chips">
        {[...asStringList(attrs.tags), ...asStringList(attrs.topics)].map((item) => (
          <em key={item}>{item}</em>
        ))}
      </div>
      {asString(attrs.summary) ? <p className="yaml-card-summary">{asString(attrs.summary)}</p> : null}
      {facts.length ? (
        <dl className="yaml-card-facts">
          {facts.map(([key, value]) => (
            <div key={key}>
              <dt>{fieldLabel(key)}</dt>
              <dd>{formatValue(value)}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {asStringList(attrs.related).length ? (
        <div className="yaml-card-related">
          {asStringList(attrs.related).map((ref) => (
            <button
              key={ref}
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                onWikiClick?.(ref)
              }}
            >
              {displayWiki(ref, workspace.get().sheets)}
            </button>
          ))}
        </div>
      ) : null}
      {onEdit ? <small>点击卡片或 Ctrl+Y 编辑元数据</small> : null}
    </section>
  )
}

function formatValue(value: YamlValue): string {
  if (Array.isArray(value)) return value.map(String).join(' · ')
  if (typeof value === 'boolean') return value ? '是' : '否'
  return String(value)
}
