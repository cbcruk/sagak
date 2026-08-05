import { signal, type Signal } from '@preact/signals'
import { useMemo } from 'preact/hooks'
import {
  CoreEvents,
  HistoryEvents,
  TextStyleEvents,
  type EditorContext,
  type FormattingState,
} from 'sagak-core'
import { useEditorContext } from '../context/editor-context'

/**
 * 에디터가 알려 주는 상태를 **필드별 신호**로 보관합니다.
 *
 * 훅으로 들고 있으면 그 훅을 부른 컴포넌트가 통째로 다시 그려집니다.
 * `isBold` 하나가 뒤집힐 때 `Toolbar` 안에서 훅을 부르면 컴포넌트 195개가,
 * 잎으로 내려도 14개가 그려집니다 — 그중 대부분은 값이 바뀌지도 않았습니다.
 * 신호는 **읽은 곳만** 다시 그리므로 4개로 줄어듭니다.
 *
 * 측정과 대안 비교는 `docs/selection-state.md` §8~§10 참고.
 *
 * **주의 — `.value` 는 잎에서 읽어야 합니다.** 부모에서 읽으면 부모가 통째로
 * 다시 그려져 훅과 같아집니다. 경고해 주는 것이 없으니 규율로 지켜야 합니다.
 */

type BooleanSignals<T> = { [K in keyof T]: Signal<boolean> }

/**
 * 구독은 해제하지 않습니다. `EditorCore.destroy()` 가 `eventBus.clearAll()` 을
 * 부르므로 에디터와 함께 사라지고, 저장소도 컨텍스트가 사라지면 수거됩니다.
 */
function createStore<T extends Record<keyof T, boolean>>(
  context: EditorContext,
  event: string,
  initial: T
): BooleanSignals<T> {
  const signals = {} as BooleanSignals<T>
  const keys = Object.keys(initial) as (keyof T)[]

  for (const key of keys) {
    signals[key] = signal(initial[key])
  }

  context.eventBus.on(event, 'on', (data?: unknown) => {
    if (!data || typeof data !== 'object') return

    for (const key of keys) {
      const next = (data as Record<string, unknown>)[key as string]
      // 값이 같으면 신호가 알아서 통지를 건너뜁니다
      if (typeof next === 'boolean') {
        signals[key].value = next
      }
    }
  })

  return signals
}

const stores = new WeakMap<EditorContext, Map<string, unknown>>()

function useStore<T extends Record<keyof T, boolean>>(
  event: string,
  initial: T
): BooleanSignals<T> {
  const context = useEditorContext()

  return useMemo(() => {
    let byEvent = stores.get(context)
    if (!byEvent) {
      byEvent = new Map()
      stores.set(context, byEvent)
    }

    let store = byEvent.get(event)
    if (!store) {
      store = createStore(context, event, initial)
      byEvent.set(event, store)
    }

    return store as BooleanSignals<T>
    // `initial` 은 저장소를 처음 만들 때만 쓰이므로 의존성이 아닙니다
  }, [context, event])
}

const formattingInitial: FormattingState = {
  isBold: false,
  isItalic: false,
  isUnderline: false,
  isStrikeThrough: false,
  isSubscript: false,
  isSuperscript: false,
}

export type FormattingSignals = BooleanSignals<FormattingState>

export function useFormattingSignals(): FormattingSignals {
  return useStore(CoreEvents.FORMATTING_STATE_CHANGED, formattingInitial)
}

export interface HistoryState {
  canUndo: boolean
  canRedo: boolean
}

export type HistorySignals = BooleanSignals<HistoryState>

export function useHistorySignals(): HistorySignals {
  return useStore(HistoryEvents.HISTORY_STATE_CHANGED, {
    canUndo: false,
    canRedo: false,
  })
}

export interface FormattingCommands {
  toggleBold: () => void
  toggleItalic: () => void
  toggleUnderline: () => void
  toggleStrikeThrough: () => void
}

export function useFormattingCommands(): FormattingCommands {
  const { eventBus } = useEditorContext()

  return useMemo(
    () => ({
      toggleBold: () => eventBus.emit(TextStyleEvents.BOLD_CLICKED),
      toggleItalic: () => eventBus.emit(TextStyleEvents.ITALIC_CLICKED),
      toggleUnderline: () => eventBus.emit(TextStyleEvents.UNDERLINE_CLICKED),
      toggleStrikeThrough: () =>
        eventBus.emit(TextStyleEvents.STRIKE_CLICKED),
    }),
    [eventBus]
  )
}

export interface HistoryCommands {
  undo: () => void
  redo: () => void
}

export function useHistoryCommands(): HistoryCommands {
  const { eventBus } = useEditorContext()

  return useMemo(
    () => ({
      undo: () => eventBus.emit(HistoryEvents.UNDO),
      redo: () => eventBus.emit(HistoryEvents.REDO),
    }),
    [eventBus]
  )
}
