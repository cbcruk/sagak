import { logger } from '@/core/logger'
import type { Plugin, EditorContext } from '@/core'
import { WysiwygEvents, CoreEvents } from '@/core'
import { createErrorReporter, type ErrorReporter } from '@/core/errors'

/**
 * Auto-save status
 */
export type AutoSaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error'

/**
 * Auto-save event data
 */
export interface AutoSaveEventData {
  status: AutoSaveStatus
  timestamp?: number
  error?: Error
}

/**
 * Auto-save plugin options
 */
export interface AutoSavePluginOptions {
  /**
   * Storage key for saving content
   * @default 'sagak-editor-autosave'
   */
  storageKey?: string

  /**
   * Debounce delay in milliseconds
   * @default 2000
   */
  debounceMs?: number

  /**
   * Auto-save interval in milliseconds (0 to disable)
   * @default 30000
   */
  intervalMs?: number

  /**
   * Custom save function (overrides localStorage)
   */
  onSave?: (content: string) => Promise<void> | void

  /**
   * Custom load function (overrides localStorage)
   */
  onLoad?: () => Promise<string | null> | string | null

  /**
   * Callback when auto-save status changes
   */
  onStatusChange?: (data: AutoSaveEventData) => void

  /**
   * Whether to restore saved content on initialization
   * @default false
   */
  restoreOnInit?: boolean
}

/**
 * Auto-save events
 */
export const AutoSaveEvents = {
  AUTO_SAVE_STATUS_CHANGED: 'AUTO_SAVE_STATUS_CHANGED',
  AUTO_SAVE_RESTORE: 'AUTO_SAVE_RESTORE',
  AUTO_SAVE_CLEAR: 'AUTO_SAVE_CLEAR',
} as const

/**
 * Create auto-save plugin
 *
 * Automatically saves editor content to localStorage or custom storage.
 */
export function createAutoSavePlugin(
  options: AutoSavePluginOptions = {}
): Plugin {
  const {
    storageKey = 'sagak-editor-autosave',
    debounceMs = 2000,
    intervalMs = 30000,
    onSave,
    onLoad,
    onStatusChange,
    restoreOnInit = false,
  } = options

  const unsubscribers: Array<() => void> = []
  let debounceTimer: ReturnType<typeof setTimeout> | null = null
  let intervalTimer: ReturnType<typeof setInterval> | null = null
  let isDirty = false
  let lastSavedContent = ''

  // eventBus가 준비되기 전 기본 리포터(로그만). initialize에서 이벤트 발행 리포터로 교체됩니다.
  let reportError: ErrorReporter = (error, message) =>
    logger.error(message, error)

  const saveToStorage = (content: string): void => {
    try {
      localStorage.setItem(storageKey, content)
      localStorage.setItem(`${storageKey}-timestamp`, Date.now().toString())
    } catch (e) {
      reportError(e, 'Failed to save to localStorage:')
    }
  }

  const loadFromStorage = (): string | null => {
    try {
      return localStorage.getItem(storageKey)
    } catch (e) {
      reportError(e, 'Failed to load from localStorage:')
      return null
    }
  }

  const clearStorage = (): void => {
    try {
      localStorage.removeItem(storageKey)
      localStorage.removeItem(`${storageKey}-timestamp`)
    } catch (e) {
      reportError(e, 'Failed to clear localStorage:')
    }
  }

  return {
    name: 'utility:auto-save',

    initialize(context: EditorContext) {
      const { eventBus, element } = context

      reportError = createErrorReporter(eventBus, 'plugin:utility:auto-save')

      const emitStatus = (status: AutoSaveStatus, error?: Error): void => {
        const data: AutoSaveEventData = {
          status,
          timestamp: status === 'saved' ? Date.now() : undefined,
          error,
        }
        eventBus.emit(AutoSaveEvents.AUTO_SAVE_STATUS_CHANGED, data)
        onStatusChange?.(data)
      }

      const performSave = async (): Promise<void> => {
        if (!element) return

        const content = element.innerHTML

        if (content === lastSavedContent) {
          return
        }

        emitStatus('saving')

        try {
          if (onSave) {
            await onSave(content)
          } else {
            saveToStorage(content)
          }

          lastSavedContent = content
          isDirty = false
          emitStatus('saved')
        } catch (e) {
          emitStatus('error', e as Error)
        }
      }

      const scheduleSave = (): void => {
        if (debounceTimer) {
          clearTimeout(debounceTimer)
        }

        isDirty = true
        emitStatus('pending')

        debounceTimer = setTimeout(() => {
          performSave()
        }, debounceMs)
      }

      const unsubContentChanged = eventBus.on(
        WysiwygEvents.WYSIWYG_CONTENT_CHANGED,
        'after',
        () => {
          scheduleSave()
        }
      )
      unsubscribers.push(unsubContentChanged)

      const unsubStyleChanged = eventBus.on(
        CoreEvents.STYLE_CHANGED,
        'after',
        () => {
          scheduleSave()
        }
      )
      unsubscribers.push(unsubStyleChanged)

      const unsubRestore = eventBus.on(
        AutoSaveEvents.AUTO_SAVE_RESTORE,
        'on',
        () => {
          if (!element) return

          void (async () => {
            try {
              const content = onLoad ? await onLoad() : loadFromStorage()

              if (content) {
                element.innerHTML = content
                lastSavedContent = content
                eventBus.emit(CoreEvents.CONTENT_RESTORED)
              }
            } catch (e) {
              reportError(e, 'Failed to restore content:')
            }
          })()
        }
      )
      unsubscribers.push(unsubRestore)

      const unsubClear = eventBus.on(
        AutoSaveEvents.AUTO_SAVE_CLEAR,
        'on',
        () => {
          clearStorage()
          lastSavedContent = ''
          isDirty = false
          emitStatus('idle')
        }
      )
      unsubscribers.push(unsubClear)

      if (intervalMs > 0) {
        intervalTimer = setInterval(() => {
          if (isDirty) {
            performSave()
          }
        }, intervalMs)
      }

      const handleBeforeUnload = (e: BeforeUnloadEvent): void => {
        if (isDirty) {
          if (element) {
            const content = element.innerHTML
            if (onSave) {
              // Can't await here, just try sync save
              try {
                onSave(content)
              } catch {
                // Ignore
              }
            } else {
              saveToStorage(content)
            }
          }

          e.preventDefault()
          e.returnValue = ''
        }
      }

      window.addEventListener('beforeunload', handleBeforeUnload)
      unsubscribers.push(() => {
        window.removeEventListener('beforeunload', handleBeforeUnload)
      })

      if (restoreOnInit && element) {
        // Delay restore to run after initialContent is set
        setTimeout(() => {
          void (async () => {
            try {
              const savedContent = onLoad ? await onLoad() : loadFromStorage()

              if (savedContent && typeof savedContent === 'string') {
                element.innerHTML = savedContent
                lastSavedContent = savedContent
                eventBus.emit(CoreEvents.CONTENT_RESTORED)
              }
            } catch (e) {
              reportError(e, 'Failed to restore content on init:')
            }
          })()
        }, 0)
      }

      if (element) {
        lastSavedContent = element.innerHTML
      }

      emitStatus('idle')
    },

    destroy() {
      if (debounceTimer) {
        clearTimeout(debounceTimer)
      }

      if (intervalTimer) {
        clearInterval(intervalTimer)
      }

      unsubscribers.forEach((unsub) => unsub())
      unsubscribers.length = 0
    },
  }
}
