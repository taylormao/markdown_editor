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
  if (event.timeStamp === lastStamp) return true
  lastStamp = event.timeStamp
  event.preventDefault()
  workspace.cycleChromeMode()
  return true
}
