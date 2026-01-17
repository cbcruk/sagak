import { useState, useEffect, useCallback } from 'react'
import {
  AutoSaveEvents,
  type AutoSaveStatus,
  type AutoSaveEventData,
} from 'sagak-core'
import { useEditorContext } from '../context/editor-context'

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

  useEffect(() => {
    if (!context?.eventBus) return

    const { eventBus } = context

    const unsubStatus = eventBus.on(
      AutoSaveEvents.AUTO_SAVE_STATUS_CHANGED,
      'on',
      (data?: unknown) => {
        if (!data || typeof data !== 'object') return

        const { status: newStatus, timestamp } = data as AutoSaveEventData

        setStatus(newStatus)

        if (timestamp) {
          setLastSaved(new Date(timestamp))
        }
      }
    )

    return () => {
      unsubStatus()
    }
  }, [context?.eventBus])

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
