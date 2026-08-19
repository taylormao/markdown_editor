import type { Sheet } from '../../types'
import { fingerprintSheet } from '../sheet-tracking'
import { isTrackedSheetIn, sheetType } from './helpers'
import type { Core, SheetTrackingRecord, Tracking } from './types'

// tracking：会话级指纹追踪。
// 持有 sessionBaselines/createdThisSession/touchedThisSession 三个会话集合。
// 所有 state 访问都通过 core.get() 实时读取，不捕获旧值（异步回调安全）。
// 逻辑与原 workspace-store.ts 内联版本完全一致（行为不变）。

const sessionBaselines = new Map<string, Promise<string>>()
const createdThisSession = new Set<string>()
const touchedThisSession = new Set<string>()

export function createTracking(core: Core): Tracking {
  function beginTracking(id: string) {
    const state = core.get()
    const sheet = state.sheets.find((item) => item.id === id)
    if (!sheet || !isTrackedSheetIn(state.folders, sheet) || sessionBaselines.has(id)) return
    const snapshot = { ...sheet }
    sessionBaselines.set(id, fingerprintSheet(snapshot))
  }

  function markTouched(id: string) {
    const state = core.get()
    const sheet = state.sheets.find((item) => item.id === id)
    if (!sheet || !isTrackedSheetIn(state.folders, sheet)) return
    beginTracking(id)
    touchedThisSession.add(id)
    const baseline = sessionBaselines.get(id)
    if (!baseline) return
    void baseline.then((fingerprint) => {
      const now = core.get()
      const sheetNow = now.sheets.find((item) => item.id === id)
      if (!sheetNow || !isTrackedSheetIn(now.folders, sheetNow)) return
      const tracking = now.tracking[id]
      if (tracking?.baselineFingerprint) return
      core.set(
        {
          tracking: {
            ...now.tracking,
            [id]: { baselineFingerprint: fingerprint, touched: true, pendingClassification: tracking?.pendingClassification ?? true },
          },
        },
        true,
      )
    })
  }

  function clearTracking(id: string): Record<string, SheetTrackingRecord> {
    sessionBaselines.delete(id)
    touchedThisSession.delete(id)
    createdThisSession.delete(id)
    const state = core.get()
    const tracking = { ...state.tracking }
    delete tracking[id]
    return tracking
  }

  return { beginTracking, markTouched, clearTracking, sessionBaselines, createdThisSession, touchedThisSession }
}

export function isSessionTracked(sheet: Sheet): boolean {
  return sheetType(sheet) !== 'spark'
}
