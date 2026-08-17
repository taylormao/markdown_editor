import { useMemo, useState } from 'react'
import { asString, splitFrontmatter } from '../lib/frontmatter'
import { useWorkspace, workspace } from '../lib/workspace-store'

type ChecklistProps = {
  title: string
  hint: string
  ids: string[]
  confirmLabel: string
  onConfirm: (ids: string[]) => void
  onCancel: () => void
}

function Checklist({ title, hint, ids, confirmLabel, onConfirm, onCancel }: ChecklistProps) {
  const { sheets, folders } = useWorkspace()
  const [selected, setSelected] = useState<string[]>(ids)
  const items = ids.map((id) => sheets.find((sheet) => sheet.id === id)).filter((sheet) => Boolean(sheet))
  return (
    <div className="template-mask">
      <div className="workflow-dialog">
        <header><strong>{title}</strong><span>{hint}</span></header>
        <div className="workflow-list">
          {items.map((sheet) => {
            if (!sheet) return null
            const type = asString(splitFrontmatter(sheet.content).attrs.type)
            const target = folders.find((folder) => folder.docType === type)?.name ?? '对应目录'
            return (
              <label key={sheet.id}>
                <input type="checkbox" checked={selected.includes(sheet.id)} onChange={() => setSelected((current) => current.includes(sheet.id) ? current.filter((id) => id !== sheet.id) : [...current, sheet.id])} />
                <span><b>{sheet.title}</b><em>{type ? `${type} → ${target}` : target}</em></span>
              </label>
            )
          })}
        </div>
        <footer><button className="text-btn" onClick={onCancel}>暂不处理</button><button className="primary-btn" onClick={() => onConfirm(selected)}>{confirmLabel}</button></footer>
      </div>
    </div>
  )
}

export function WorkflowDialogs() {
  const state = useWorkspace()
  const inboxId = state.folders.find((folder) => folder.systemKey === 'inbox')?.id
  const pendingIds = useMemo(() => Object.entries(state.tracking).filter(([id, record]) => {
    const sheet = state.sheets.find((item) => item.id === id)
    if (!sheet) return false
    return record.pendingClassification && sheet.folderId === inboxId && asString(splitFrontmatter(sheet.content).attrs.type) !== 'spark'
  }).map(([id]) => id), [inboxId, state.sheets, state.tracking])
  const continueIds = useMemo(() => state.sheets.filter((sheet) => sheet.folderId === inboxId && asString(splitFrontmatter(sheet.content).attrs.type) !== 'spark').map((sheet) => sheet.id), [inboxId, state.sheets])

  if (state.finishWritingIds.length) return <Checklist key="finish" title="整理本次编辑的文稿" hint="归类所选文稿，未选内容继续留在收集箱" ids={state.finishWritingIds} confirmLabel="归类所选文稿" onConfirm={(ids) => workspace.finishWriting(ids)} onCancel={() => workspace.closeFinishWriting()} />
  if (state.startupStep === 'classify') return <Checklist key="classify" title="上次待归类的文稿" hint="先处理已经告一段落的内容" ids={pendingIds} confirmLabel="归类所选文稿" onConfirm={(ids) => workspace.classifyPending(ids)} onCancel={() => workspace.classifyPending([])} />
  if (state.startupStep === 'continue') return <Checklist key="continue" title="继续上次的工作" hint="所选文稿会作为标签打开，第一个获得焦点" ids={continueIds} confirmLabel="打开所选文稿" onConfirm={(ids) => workspace.openContinued(ids)} onCancel={() => workspace.closeStartup()} />
  return null
}
