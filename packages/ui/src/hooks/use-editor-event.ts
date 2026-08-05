import { useEffect, useRef } from 'preact/hooks'
import type { EventPhase, PayloadOf } from 'sagak-core'
import { useEditorContext } from '../context/editor-context'

/**
 * 에디터 이벤트를 구독합니다.
 *
 * 직접 `useEffect` 로 쓰면 매번 두 가지를 챙겨야 합니다.
 *
 * **① 해제.** `eventBus.on` 이 돌려주는 함수를 반환하지 않으면 샙니다.
 *
 * **② 핸들러 신원.** 핸들러는 렌더마다 새 클로저입니다. 의존성에 넣으면 매
 * 렌더 재구독하고, 빼면 오래된 값을 붙듭니다. 답은 ref 에 최신 핸들러를 담고
 * 구독은 한 번만 하는 것인데, 이 저장소에 이미 **두 곳이 손으로** 같은 걸
 * 만들어 두고 있었습니다 (`use-editor-error`, `use-selection-derived`).
 *
 * 그 둘을 여기 한 곳으로 모읍니다.
 *
 * ## 타입은 그대로 흐릅니다
 *
 * `EventBus.on` 은 이미 `PayloadOf<E>` 로 페이로드 타입을 알려 줍니다.
 * 이 훅도 같은 형태를 유지하므로 `(data?: unknown)` 으로 받아 손으로 좁힐
 * 필요가 없습니다.
 *
 * ```ts
 * // 이전 — 이미 있는 타입을 버리고 런타임에 다시 확인
 * eventBus.on(AUTO_SAVE_STATUS_CHANGED, 'on', (data?: unknown) => {
 *   if (!data || typeof data !== 'object') return
 *   const { status } = data as AutoSaveEventData
 * })
 *
 * // 지금 — status 는 이미 타입이 있습니다
 * useEditorEvent(AUTO_SAVE_STATUS_CHANGED, 'on', ({ status }) => { ... })
 * ```
 *
 * 가변 인자(`...args`)로 넘기는 형태로 만들면 이 타입이 끊깁니다.
 * 그래서 인자를 셋으로 고정했습니다.
 */
export function useEditorEvent<E extends string>(
  event: E,
  phase: EventPhase,
  handler: (payload: PayloadOf<E>) => void
): void {
  const { eventBus } = useEditorContext()

  const handlerRef = useRef(handler)
  handlerRef.current = handler

  useEffect(
    () =>
      eventBus.on(event, phase, (payload: PayloadOf<E>) => {
        handlerRef.current(payload)
      }),
    [eventBus, event, phase]
  )
}
