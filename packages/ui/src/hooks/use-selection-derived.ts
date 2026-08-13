import { useState, useEffect, useRef } from 'preact/hooks'
import { CoreEvents, type EditorContext } from 'sagak-core'
import { useEditorContext } from '../context/editor-context'

/**
 * 선택 영역에서 값을 끌어오는 컴포넌트들이 공유하는 구독입니다.
 *
 * 이전에는 여섯 곳이 같은 세 소스(`selectionchange`, `STYLE_CHANGED`,
 * `CONTENT_RESTORED`)를 각자 구독했고, **가드가 제각각이었습니다** — IME 가드와
 * 에디터 범위 확인과 `rAF` 지연을 다 갖춘 건 하나뿐이었습니다. 여기 한 곳으로
 * 모아 규약을 하나로 만듭니다.
 *
 * 가드는 `EditorCore.setupFormattingStateTracking()` 과 같은 순서를 따릅니다.
 *
 * 1. 조합 중이면 아무것도 하지 않습니다 — 한글 입력 중에는 keystroke 마다
 *    `selectionchange` 가 오지만 그때 읽은 값은 의미가 없습니다.
 * 2. 다음 프레임까지 미룹니다 — 브라우저가 선택 영역을 확정하기 전에 읽으면
 *    직전 값을 봅니다.
 * 3. 선택이 에디터 밖이면 건너뜁니다 — 툴바 버튼이나 드롭다운을 눌렀을 때
 *    마지막 상태를 유지해야 합니다.
 *
 * 자세한 배경은 `docs/selection-state.md` 참고.
 */

type Listener = () => void

interface Tracker {
  subscribe(listener: Listener): () => void
}

const trackers = new WeakMap<EditorContext, Tracker>()

function createTracker(context: EditorContext): Tracker {
  const listeners = new Set<Listener>()
  let frame: number | null = null
  let detach: (() => void) | null = null

  const isSelectionInEditor = (): boolean => {
    const element = context.element
    if (!element) return false

    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) return false

    const anchorNode = selection.anchorNode
    return !!anchorNode && element.contains(anchorNode)
  }

  const schedule = (): void => {
    if (context.selectionManager?.getIsComposing()) return

    if (frame !== null) {
      cancelAnimationFrame(frame)
    }

    frame = requestAnimationFrame(() => {
      frame = null
      if (!isSelectionInEditor()) return
      for (const listener of listeners) listener()
    })
  }

  const attach = (): void => {
    document.addEventListener('selectionchange', schedule)
    const unsubStyle = context.eventBus.on(
      CoreEvents.STYLE_CHANGED,
      'after',
      schedule
    )
    const unsubRestored = context.eventBus.on(
      CoreEvents.CONTENT_RESTORED,
      'after',
      schedule
    )

    detach = () => {
      document.removeEventListener('selectionchange', schedule)
      unsubStyle()
      unsubRestored()
      if (frame !== null) {
        cancelAnimationFrame(frame)
        frame = null
      }
    }
  }

  return {
    subscribe(listener) {
      if (listeners.size === 0) attach()
      listeners.add(listener)

      return () => {
        listeners.delete(listener)
        if (listeners.size === 0) {
          detach?.()
          detach = null
        }
      }
    },
  }
}

/**
 * 선택 영역 구독 — **렌더러와 무관합니다.**
 *
 * 위의 가드 셋(IME 조합 중 무시 · 다음 프레임까지 지연 · 에디터 밖이면 건너뜀)은
 * Preact 를 하나도 안 씁니다. 커스텀 엘리먼트로 옮기는 컴포넌트도 이 구독을
 * **그대로** 써야 합니다 — 안 그러면 가드를 다시 구현하게 되고, 그건 이 파일
 * 첫머리에 적힌 "여섯 곳이 제각각이던" 상태로 되돌아가는 길입니다.
 */
export function subscribeToSelection(
  context: EditorContext,
  listener: Listener
): () => void {
  return getTracker(context).subscribe(listener)
}

function getTracker(context: EditorContext): Tracker {
  let tracker = trackers.get(context)
  if (!tracker) {
    tracker = createTracker(context)
    trackers.set(context, tracker)
  }
  return tracker
}

/**
 * 선택 영역이 바뀔 때마다 `derive` 를 다시 실행하고 그 값을 돌려줍니다.
 *
 * 값이 그대로면 다시 그리지 않습니다. `derive` 는 렌더 중이 아니라 구독
 * 콜백에서 불리므로 최신 참조를 ref 로 붙듭니다.
 *
 * @example
 * ```ts
 * const alignment = useSelectionDerived(getCurrentAlignment, 'left')
 * ```
 */
export function useSelectionDerived<T>(derive: () => T, initial: T): T {
  const context = useEditorContext()
  const [value, setValue] = useState<T>(initial)

  const deriveRef = useRef(derive)
  deriveRef.current = derive

  useEffect(() => {
    const update = (): void => {
      const next = deriveRef.current()
      setValue((prev) => (Object.is(prev, next) ? prev : next))
    }

    update()
    return getTracker(context).subscribe(update)
  }, [context])

  return value
}
