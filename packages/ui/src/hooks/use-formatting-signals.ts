import { signal, type Signal } from '@preact/signals'
import { useEffect, useMemo } from 'preact/hooks'
import {
  CoreEvents,
  TextStyleEvents,
  type EditorContext,
  type FormattingState,
} from 'sagak-core'
import { useEditorContext } from '../context/editor-context'

/**
 * 스파이크 B — 서식 상태를 신호로 둡니다.
 *
 * 훅으로 상태를 들고 있으면 그 훅을 부른 컴포넌트가 통째로 다시 그려집니다.
 * 신호는 **읽은 곳만** 다시 그립니다. `isBold` 가 바뀌면 Bold 토글만 갱신되고
 * 나머지 세 토글은 건드리지 않습니다.
 */

export type FormattingSignals = {
  [K in keyof FormattingState]: Signal<boolean>
}

const stores = new WeakMap<
  EditorContext,
  { signals: FormattingSignals; dispose: () => void; refs: number }
>()

function isFormattingState(data: unknown): data is FormattingState {
  return (
    !!data &&
    typeof data === 'object' &&
    typeof (data as FormattingState).isBold === 'boolean'
  )
}

function createStore(context: EditorContext) {
  const signals: FormattingSignals = {
    isBold: signal(false),
    isItalic: signal(false),
    isUnderline: signal(false),
    isStrikeThrough: signal(false),
    isSubscript: signal(false),
    isSuperscript: signal(false),
  }

  const dispose = context.eventBus.on(
    CoreEvents.FORMATTING_STATE_CHANGED,
    'on',
    (data?: unknown) => {
      if (!isFormattingState(data)) return
      for (const key of Object.keys(signals) as (keyof FormattingState)[]) {
        // 값이 같으면 신호가 알아서 통지를 건너뜁니다
        signals[key].value = data[key]
      }
    }
  )

  return { signals, dispose, refs: 0 }
}

export function useFormattingSignals(): FormattingSignals {
  const context = useEditorContext()

  const store = useMemo(() => {
    let existing = stores.get(context)
    if (!existing) {
      existing = createStore(context)
      stores.set(context, existing)
    }
    return existing
  }, [context])

  useEffect(() => {
    store.refs += 1
    return () => {
      store.refs -= 1
      if (store.refs === 0) {
        store.dispose()
        stores.delete(context)
      }
    }
  }, [context, store])

  return store.signals
}

export function useFormattingCommands(): Record<string, () => void> {
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
