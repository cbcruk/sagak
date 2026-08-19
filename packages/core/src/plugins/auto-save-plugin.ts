import { subscribeToModel } from '@/model/bridge'
import { logger } from '@/core/logger'
import type { Plugin, EditorContext } from '@/core'
import { CoreEvents } from '@/core'
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

      /*
       * **문서를 읽고 쓰는 자리를 모델로 옮깁니다.**
       *
       * 예전에는 `element.innerHTML` 을 직접 읽고 썼습니다. 편집 영역이
       * `prosemirror-view` 의 것이 된 뒤로 밖에서 `innerHTML` 을 갈아 끼우면
       * 모델과 어긋납니다 — 되살리기가 조용히 문서를 망가뜨리는 자리였습니다.
       */
      const area = () => context.editingAreaManager?.getCurrentArea()
      const readContent = (): string | null => {
        const current = area()

        return current ? current.getRawContent() : (element?.innerHTML ?? null)
      }
      const writeContent = (html: string): void => {
        const current = area()

        if (current) current.setRawContent(html)
        else if (element) element.innerHTML = html
      }

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
        if (readContent() === next) return

        writeContent(next)
      }

      const performSave = async (): Promise<void> => {
        const content = readContent()

        if (content === null) return

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

      /*
       * **문서가 바뀌면 저장 예약** — 트랜잭션 하나가 신호입니다.
       *
       * 예전에는 편집 영역이 `WYSIWYG_CONTENT_CHANGED` 를 실어 보냈습니다.
       * 그건 `dispatchTransaction` 을 버스로 감싼 것이라, 같은 것을 두 번
       * 거치는 셈이었습니다.
       */
      const unsubContent = subscribeToModel(context, (_state, tr) => {
        /*
         * **프로그램이 갈아 끼운 것은 사용자가 친 것이 아닙니다.**
         *
         * `tr` 이 `null` 이면 문서를 통째로 바꾼 것입니다 — 문서를 열거나
         * 초안을 되살린 것. 그걸 저장 신호로 치면 열자마자 저장됩니다.
         */
        if (!tr) return

          scheduleSave()
      })
      unsubscribers.push(unsubContent)

      const unsubStyleChanged = eventBus.on(
        CoreEvents.STYLE_CHANGED, () => {
          scheduleSave()
        }
      )
      unsubscribers.push(unsubStyleChanged)

      const unsubRestore = eventBus.on(
        AutoSaveEvents.AUTO_SAVE_RESTORE, () => {
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
        AutoSaveEvents.AUTO_SAVE_CLEAR, () => {
          /*
           * **저장소만 비웁니다.** 쓰던 글은 건드리지 않습니다.
           *
           * 문서까지 되돌리게 만들어 봤다가 되돌렸습니다. 자동 저장은 여기서
           * 문서의 **백업**이지 문서 자체가 아닙니다 — 백업을 지운다고 원본을
           * 되감을 이유가 없습니다. TinyMCE·WordPress·CKEditor 도 같은 모델이고,
           * 셋 다 "버리기" 버튼 없이 복원 쪽만 둡니다.
           *
           * 대신 눌러도 아무 일 없어 보이던 문제는 **라벨**에서 풉니다
           * (`auto-save-indicator`).
           */
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
          {
            const content = readContent() ?? ''
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
         * (`createEditor` 가 `run()` 다음에 `setContent` 합니다). 그래서 복원은
         * 한 틱 기다려야 초기 내용을 덮어쓸 수 있습니다.
         */
        setTimeout(() => {
          void (async () => {
            if (!restoreOnInit) return

            try {
              const savedContent = onLoad ? await onLoad() : loadFromStorage()

              if (savedContent && typeof savedContent === 'string') {
                /*
                 * 여기서는 `replaceContent` 를 쓰지 않습니다. 시작하자마자
                 * 히스토리에 항목을 넣으면 아무것도 안 했는데 Undo 가 켜집니다.
                 * 사용자가 한 일이 아니라 되돌릴 대상도 아닙니다.
                 */
                writeContent(savedContent)
                lastSavedContent = savedContent
              }
            } catch (e) {
              reportError(e, 'Failed to restore content on init:')
            }
          })()
        }, 0)
      }

      lastSavedContent = readContent() ?? ''

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
