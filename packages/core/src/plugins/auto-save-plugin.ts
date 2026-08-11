import { logger } from '@/core/logger'
import type { Plugin, EditorContext } from '@/core'
import { WysiwygEvents, CoreEvents } from '@/core'
import { createErrorReporter, type ErrorReporter } from '@/core/errors'



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

// 이벤트 상수는 core/events.ts 에 모여 있습니다 (EditorEventMap 과 함께 관리)
import { AutoSaveEvents } from '@/core/events'
import type { AutoSaveStatus, AutoSaveEventData } from '@/core/event-map'

export { AutoSaveEvents }
export type { AutoSaveStatus, AutoSaveEventData }

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

  /**
   * 초안이 얹히기 **전**의 문서입니다.
   *
   * `AUTO_SAVE_CLEAR`(Discard) 가 여기로 되돌립니다. 이게 없으면 "초안을
   * 버린다" 면서 저장소만 지우고 화면의 초안은 그대로 두게 됩니다.
   *
   * `null` 은 아직 정하지 못했다는 뜻입니다 — `initialContent` 는 플러그인
   * 초기화가 끝난 **뒤에** 들어오므로 한 틱 기다려야 합니다.
   */
  let baselineContent: string | null = null

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

      /**
       * 문서를 통째로 갈아끼우되 **되돌리기로 살릴 수 있게** 합니다.
       *
       * 그냥 `innerHTML` 에 넣으면 히스토리에 안 들어갑니다 — 실제로 초안을
       * 복원한 직후 Undo 버튼이 비활성이었습니다. 잘못 눌렀을 때 복구할
       * 수단이 없다는 뜻입니다.
       *
       * 스타일 커맨드가 쓰는 방식과 같습니다 — 바꾸기 전과 후를 각각
       * `CAPTURE_SNAPSHOT` 으로 남기면 Undo 가 바꾸기 전으로 돌아갑니다.
       */
      const replaceContent = (next: string): void => {
        if (!element || element.innerHTML === next) return

        eventBus.emit(CoreEvents.CAPTURE_SNAPSHOT)
        element.innerHTML = next
        eventBus.emit(CoreEvents.CAPTURE_SNAPSHOT)
        eventBus.emit(CoreEvents.CONTENT_RESTORED)
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
                replaceContent(content)
                lastSavedContent = content
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

          /*
           * 저장소만 지우면 "버렸다" 는 말과 화면이 어긋납니다. 초안이 얹히기
           * 전으로 문서를 되돌려야 버린 것입니다.
           */
          if (baselineContent !== null) {
            replaceContent(baselineContent)
          }

          lastSavedContent = element?.innerHTML ?? ''
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

      if (element) {
        /*
         * `initialContent` 는 플러그인이 다 붙은 **뒤에** 들어옵니다
         * (`createEditor` 가 `run()` 다음에 `setContent` 합니다). 그래서 한 틱
         * 기다려야 "초안 이전의 문서" 를 볼 수 있습니다.
         */
        setTimeout(() => {
          void (async () => {
            baselineContent = element.innerHTML

            if (!restoreOnInit) return

            try {
              const savedContent = onLoad ? await onLoad() : loadFromStorage()

              if (savedContent && typeof savedContent === 'string') {
                /*
                 * 여기서는 `replaceContent` 를 쓰지 않습니다. 시작하자마자
                 * 히스토리에 항목을 넣으면 아무것도 안 했는데 Undo 가 켜집니다.
                 * 사용자가 한 일이 아니라 되돌릴 대상도 아닙니다.
                 */
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
