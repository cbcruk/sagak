import { subscribeToModel } from '@/model/bridge'
import { logger } from '@/core/logger'
import type { Plugin, EditorContext } from '@/core'
import { CoreEvents } from '@/core'
import { createErrorReporter, type ErrorReporter } from '@/core/errors'

/**
 * 자동 저장 — **모듈 API 입니다.**
 *
 * ## 셋이 하던 일
 *
 * `AUTO_SAVE_STATUS_CHANGED` 는 표시가 실제로 듣고 있었습니다 — 코어가 먼저
 * 말을 거는 쪽이라 `subscribe` 로 옮깁니다(자동 완성과 같은 갈래).
 *
 * `AUTO_SAVE_CLEAR` 는 표시의 "Delete saved draft" 가 부르는 것이라 메서드가
 * 맞습니다. `AUTO_SAVE_RESTORE` 는 **아무도 안 불렀습니다** — 처리자만 있고
 * 부르는 쪽이 없었습니다. 이미지 업로드의 `FROM_FILE` 과 같은 모양인데, 그때와
 * 달리 사본이 생기지는 않았습니다: 아무도 그 기능을 안 찾았을 뿐입니다.
 * 그래도 남깁니다 — 초안을 되살리는 것은 임베더가 자기 버튼에 달 만한 일이고,
 * 이제는 **이름으로 부를 수 있는 자리**에 있습니다.
 *
 * ## 마지막 저장 시각의 주인이 여기입니다
 *
 * 예전에는 `timestamp` 를 `saved` 일 때만 실어 보냈고, 표시가 그것을 받아
 * **자기 쪽에 쟁여 두고** 다음 상태들에 걸쳐 유지했습니다. 지우기를 누르면
 * 표시가 자기 사본을 `null` 로 되돌렸고요. 상태 하나를 두 곳에서 관리한
 * 것입니다. 여기서는 `savedAt` 이 상태의 일부라 표시는 그리기만 합니다.
 */
export type AutoSaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error'

export interface AutoSaveState {
  status: AutoSaveStatus
  /** 마지막으로 저장된 시각. 저장된 적이 없거나 버렸으면 `null` */
  savedAt: number | null
  error?: Error
}

export interface AutoSaveOptions {
  /** @default 'sagak-editor-autosave' */
  storageKey?: string

  /** @default 2000 */
  debounceMs?: number

  /** 0 이면 끕니다 @default 30000 */
  intervalMs?: number

  /** localStorage 대신 직접 저장합니다 */
  onSave?: (content: string) => Promise<void> | void

  /** localStorage 대신 직접 읽습니다 */
  onLoad?: () => Promise<string | null> | string | null

  onStatusChange?: (state: AutoSaveState) => void

  /** 시작할 때 저장된 초안을 되살립니다 @default false */
  restoreOnInit?: boolean
}

export interface AutoSave {
  /** 상태가 바뀔 때마다 — 지금 값을 곧바로 한 번 줍니다 */
  subscribe(listener: (state: AutoSaveState) => void): () => void
  /**
   * **밖에서 저장하는 경우** 상태를 알립니다.
   *
   * 이 저장소만 해도 문서는 OPFS 로 따로 저장합니다 — 그런 저장 경로도 같은
   * 표시를 쓸 수 있어야 합니다. 예전에는 `AUTO_SAVE_STATUS_CHANGED` 를 직접
   * 쏘면 됐고, 그것이 이 이벤트의 유일한 남은 값이었습니다.
   *
   * `savedAt` 을 안 주면 `'saved'` 는 지금 시각으로, 나머지는 앞의 값을
   * 유지합니다.
   */
  report(status: AutoSaveStatus, savedAt?: number): void
  /** 지금 바로 저장합니다 (예약을 기다리지 않고) */
  save(): Promise<void>
  /** 저장된 초안을 지금 글에 되살립니다 */
  restore(): Promise<boolean>
  /**
   * **저장소만 비웁니다.** 쓰던 글은 건드리지 않습니다.
   *
   * 문서까지 되돌리게 만들어 봤다가 되돌렸습니다. 자동 저장은 문서의
   * **백업**이지 문서 자체가 아닙니다 — 백업을 지운다고 원본을 되감을 이유가
   * 없습니다. TinyMCE·WordPress·CKEditor 도 같은 모델입니다.
   */
  clear(): void
}

const DEFAULTS = {
  storageKey: 'sagak-editor-autosave',
  debounceMs: 2000,
  intervalMs: 30000,
  restoreOnInit: false,
} as const

interface Session {
  options: AutoSaveOptions
  state: AutoSaveState
  listeners: Set<(state: AutoSaveState) => void>
  dirty: boolean
  lastSaved: string
  debounce: ReturnType<typeof setTimeout> | null
  report: ErrorReporter
}

const sessions = new WeakMap<EditorContext, Session>()

function sessionOf(context: EditorContext): Session {
  const existing = sessions.get(context)

  if (existing) return existing

  const session: Session = {
    options: {},
    state: { status: 'idle', savedAt: null },
    listeners: new Set(),
    dirty: false,
    lastSaved: '',
    debounce: null,
    report: (error, message) => logger.error(message, error),
  }

  sessions.set(context, session)

  return session
}

/**
 * `savedAt` 을 안 주면 **`'saved'` 만 지금 시각으로 바뀌고 나머지는 앞의 값을
 * 유지합니다.** 저장이 끝난 뒤에도 표시가 "Saved at …" 을 계속 보여 줄 수
 * 있어야 하기 때문입니다 — 예전에는 그 유지를 표시 쪽이 제 손으로 했습니다.
 */
function setStatus(
  session: Session,
  status: AutoSaveStatus,
  override?: { savedAt?: number | null; error?: Error }
): void {
  const savedAt =
    override && 'savedAt' in override
      ? (override.savedAt ?? null)
      : status === 'saved'
        ? Date.now()
        : session.state.savedAt

  session.state = {
    status,
    savedAt,
    ...(override?.error ? { error: override.error } : {}),
  }

  for (const listener of session.listeners) listener(session.state)

  session.options.onStatusChange?.(session.state)
}

/**
 * 문서를 읽고 쓰는 자리는 **모델입니다.**
 *
 * 예전에는 `element.innerHTML` 을 직접 읽고 썼습니다. 편집 영역이
 * `prosemirror-view` 의 것이 된 뒤로 밖에서 `innerHTML` 을 갈아 끼우면 모델과
 * 어긋납니다 — 되살리기가 조용히 문서를 망가뜨리는 자리였습니다.
 */
function readContent(context: EditorContext): string | null {
  const area = context.editingAreaManager?.getCurrentArea()

  return area ? area.getRawContent() : (context.element?.innerHTML ?? null)
}

function writeContent(context: EditorContext, html: string): void {
  const area = context.editingAreaManager?.getCurrentArea()

  if (area) area.setRawContent(html)
  else if (context.element) context.element.innerHTML = html
}

const modules = new WeakMap<EditorContext, AutoSave>()

export function autoSave(context: EditorContext): AutoSave {
  const existing = modules.get(context)

  if (existing) return existing

  const session = sessionOf(context)

  const key = (): string => session.options.storageKey ?? DEFAULTS.storageKey

  const load = async (): Promise<string | null> => {
    const { onLoad } = session.options

    try {
      return onLoad ? await onLoad() : localStorage.getItem(key())
    } catch (e) {
      session.report(e, 'Failed to load from localStorage:')

      return null
    }
  }

  const module: AutoSave = {
    subscribe(listener) {
      session.listeners.add(listener)
      listener(session.state)

      return () => {
        session.listeners.delete(listener)
      }
    },

    report(status, savedAt) {
      setStatus(session, status, savedAt === undefined ? undefined : { savedAt })
    },

    async save() {
      const content = readContent(context)

      if (content === null || content === session.lastSaved) return

      setStatus(session, 'saving')

      try {
        const { onSave } = session.options

        if (onSave) await onSave(content)
        else {
          localStorage.setItem(key(), content)
          localStorage.setItem(`${key()}-timestamp`, Date.now().toString())
        }

        session.lastSaved = content
        session.dirty = false
        setStatus(session, 'saved')
      } catch (e) {
        setStatus(session, 'error', { error: e as Error })
      }
    },

    async restore() {
      const content = await load()

      if (!content) return false

      if (readContent(context) !== content) {
        writeContent(context, content)
      }

      session.lastSaved = content

      return true
    },

    clear() {
      try {
        localStorage.removeItem(key())
        localStorage.removeItem(`${key()}-timestamp`)
      } catch (e) {
        session.report(e, 'Failed to clear localStorage:')
      }

      session.lastSaved = ''
      session.dirty = false
      setStatus(session, 'idle', { savedAt: null })
    },
  }

  modules.set(context, module)

  return module
}

/**
 * 언제 저장할지를 보는 쪽 — 에디터와 생사를 같이하는 일꾼입니다.
 */
export function createAutoSavePlugin(options: AutoSaveOptions = {}): Plugin {
  const {
    debounceMs = DEFAULTS.debounceMs,
    intervalMs = DEFAULTS.intervalMs,
    restoreOnInit = DEFAULTS.restoreOnInit,
  } = options

  const unsubscribers: Array<() => void> = []
  let intervalTimer: ReturnType<typeof setInterval> | null = null
  let session: Session | null = null

  return {
    name: 'utility:auto-save',

    initialize(context: EditorContext) {
      const { eventBus, element } = context

      session = sessionOf(context)
      session.options = options
      session.report = createErrorReporter(eventBus, 'plugin:utility:auto-save')

      const current = session
      const module = autoSave(context)

      const scheduleSave = (): void => {
        if (current.debounce) clearTimeout(current.debounce)

        current.dirty = true
        setStatus(current, 'pending')

        current.debounce = setTimeout(() => {
          void module.save()
        }, debounceMs)
      }

      /*
       * **문서가 바뀌면 저장 예약** — 트랜잭션 하나가 신호입니다.
       *
       * `tr` 이 `null` 이면 문서를 통째로 바꾼 것입니다 — 문서를 열거나 초안을
       * 되살린 것. 그걸 저장 신호로 치면 열자마자 저장됩니다. **프로그램이
       * 갈아 끼운 것은 사용자가 친 것이 아닙니다.**
       */
      unsubscribers.push(
        subscribeToModel(context, (_state, tr) => {
          if (!tr) return

          scheduleSave()
        })
      )

      unsubscribers.push(eventBus.on(CoreEvents.STYLE_CHANGED, scheduleSave))

      if (intervalMs > 0) {
        intervalTimer = setInterval(() => {
          if (current.dirty) void module.save()
        }, intervalMs)
      }

      const handleBeforeUnload = (e: BeforeUnloadEvent): void => {
        if (!current.dirty) return

        void module.save()

        e.preventDefault()
        e.returnValue = ''
      }

      window.addEventListener('beforeunload', handleBeforeUnload)
      unsubscribers.push(() => {
        window.removeEventListener('beforeunload', handleBeforeUnload)
      })

      if (element && restoreOnInit) {
        /*
         * `initialContent` 는 플러그인이 다 붙은 **뒤에** 들어옵니다
         * (`createEditor` 가 `run()` 다음에 `setContent` 합니다). 그래서 복원은
         * 한 틱 기다려야 초기 내용을 덮어쓸 수 있습니다.
         */
        setTimeout(() => {
          void module.restore().catch((e: unknown) => {
            current.report(e, 'Failed to restore content on init:')
          })
        }, 0)
      }

      current.lastSaved = readContent(context) ?? ''

      setStatus(current, 'idle')
    },

    destroy() {
      if (session?.debounce) {
        clearTimeout(session.debounce)
        session.debounce = null
      }

      if (intervalTimer) {
        clearInterval(intervalTimer)
      }

      unsubscribers.forEach((unsub) => unsub())
      unsubscribers.length = 0
    },
  }
}
