import { workspace } from './workspace-store'

let lastStamp = -1

function isRenameField(target: EventTarget | null): boolean {
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement
}

export function handleEscape(event: KeyboardEvent): boolean {
  if (event.key !== 'Escape' && event.code !== 'Escape') return false
  if (event.isComposing) return false
  if (isRenameField(event.target)) return false
  if (document.querySelector('.slash-menu')) return false
  const state = workspace.get()
  if (state.passwordGateLabel) {
    event.preventDefault()
    workspace.closePasswordGate()
    return true
  }
  if (state.templatePickerFor) {
    event.preventDefault()
    if (state.templatePickerMode === 'quick' && state.templatePickerType) workspace.clearTemplateType()
    else workspace.closeTemplatePicker()
    return true
  }
  if (state.finishWritingIds.length) {
    event.preventDefault()
    workspace.closeFinishWriting()
    return true
  }
  if (state.startupStep) {
    event.preventDefault()
    if (state.startupStep === 'classify') workspace.classifyPending([])
    else workspace.closeStartup()
    return true
  }
  if (state.yamlEditorOpen) {
    event.preventDefault()
    workspace.closeYamlEditor()
    return true
  }
  if (event.timeStamp === lastStamp) return true
  lastStamp = event.timeStamp
  event.preventDefault()
  workspace.cycleChromeMode()
  return true
}
