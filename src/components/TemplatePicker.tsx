import { useEffect, useMemo, useState } from 'react'
import { templates, type DocType, type TemplateId } from '../lib/templates'
import { useWorkspace, workspace } from '../lib/workspace-store'

const types: readonly { id: DocType; title: string; hint: string }[] = [
  { id: 'spark', title: '念头', hint: '快速捕捉，留在收集箱' },
  { id: 'daily', title: '每日', hint: '一天一篇的反省记录' },
  { id: 'review', title: '复盘', hint: '周回顾与阶段性总结' },
  { id: 'project', title: '项目', hint: '目标、状态和下一步' },
  { id: 'meeting', title: '会议', hint: '决议与待办' },
  { id: 'video', title: '视频', hint: '单集笔记或系列目录' },
  { id: 'literature', title: '读书', hint: '书籍与长文研究' },
  { id: 'clip', title: '收藏', hint: '外部资料与下一步' },
  { id: 'tutorial', title: 'Publish', hint: '技巧备忘与发布成稿' },
] as const

export function TemplatePicker() {
  const { templatePickerMode, templatePickerType } = useWorkspace()
  const [index, setIndex] = useState(0)
  const items = useMemo(
    () => templatePickerType ? templates.filter((item) => item.type === templatePickerType) : templatePickerMode === 'quick' ? types : templates,
    [templatePickerMode, templatePickerType],
  )

  useEffect(() => setIndex(0), [templatePickerType])
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        return
      }
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault()
        const delta = event.key === 'ArrowDown' ? 1 : -1
        setIndex((current) => (current + delta + items.length) % items.length)
      }
      if (event.key === 'Enter') {
        event.preventDefault()
        const item = items[index]
        if (!item) return
        if ('type' in item) workspace.createSheetFromTemplate(item.id as TemplateId)
        else workspace.selectTemplateType(item.id)
      }
      if (event.key === 'Backspace' && templatePickerMode === 'quick' && templatePickerType) {
        event.preventDefault()
        workspace.clearTemplateType()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [index, items, templatePickerMode, templatePickerType])

  return (
    <div className="template-mask" onClick={() => workspace.closeTemplatePicker()}>
      <div className="template-dialog" onClick={(event) => event.stopPropagation()}>
        <header>
          <div>
            <strong>{templatePickerType ? '选择具体模板' : templatePickerMode === 'quick' ? '选择文稿类型' : '选一个模板新建'}</strong>
            <span>{templatePickerType ? '返回可按 Backspace' : '使用上下键与 Enter 选择'}</span>
          </div>
          <button className="dialog-close" title="关闭" onClick={() => workspace.closeTemplatePicker()}>×</button>
        </header>
        <div className="template-grid">
          {items.map((item, itemIndex) => (
            <button
              key={item.id}
              className={itemIndex === index ? 'is-active' : ''}
              onMouseEnter={() => setIndex(itemIndex)}
              onClick={() => {
                if ('type' in item) workspace.createSheetFromTemplate(item.id as TemplateId)
                else workspace.selectTemplateType(item.id)
              }}
            >
              <b>{item.title}</b>
              <em>{item.hint}</em>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
