import { useCallback, useState } from 'preact/hooks'
import { AutoSaveEvents, type AutoSaveStatus } from 'sagak-core'
import { useEditorContext } from '../context/editor-context'
import { useEditorEvent } from './use-editor-event'

export interface UseAutoSaveReturn {
  status: AutoSaveStatus
  lastSaved: Date | null
  restore: () => void
  clear: () => void
}

export function useAutoSave(): UseAutoSaveReturn {
  const context = useEditorContext()
  const [status, setStatus] = useState<AutoSaveStatus>('idle')
  const [lastSaved, setLastSaved] = useState<Date | null>(null)

  useEditorEvent(
    AutoSaveEvents.AUTO_SAVE_STATUS_CHANGED,
    'on',
    ({ status: next, timestamp }) => {
      setStatus(next)
      if (timestamp) {
        setLastSaved(new Date(timestamp))
      }
    }
  )

  const restore = useCallback(() => {
    if (!context?.eventBus) return
    context.eventBus.emit(AutoSaveEvents.AUTO_SAVE_RESTORE)
  }, [context?.eventBus])

  const clear = useCallback(() => {
    if (!context?.eventBus) return
    context.eventBus.emit(AutoSaveEvents.AUTO_SAVE_CLEAR)
    setLastSaved(null)
  }, [context?.eventBus])

  return {
    status,
    lastSaved,
    restore,
    clear,
  }
}
