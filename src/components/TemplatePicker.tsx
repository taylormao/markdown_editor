import { templates, type TemplateId } from '../lib/templates'
import { workspace } from '../lib/workspace-store'

export function TemplatePicker() {
  return (
    <div className="template-mask" onClick={() => workspace.closeTemplatePicker()}>
      <div className="template-dialog" onClick={(event) => event.stopPropagation()}>
        <header>
          <strong>选一个模板新建</strong>
          <span>每篇必须从模板来。默认是念头。</span>
        </header>
        <div className="template-grid">
          {templates.map((item) => (
            <button key={item.id} onClick={() => workspace.createSheetFromTemplate(item.id as TemplateId)}>
              <b>{item.title}</b>
              <em>{item.hint}</em>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
