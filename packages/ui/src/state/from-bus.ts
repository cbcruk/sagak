import { readable } from 'svelte/store'
import type { Readable } from 'svelte/store'
import type { EditorContext, EventPhase, PayloadOf } from 'sagak-core'

/**
 * 버스가 **밀어 주는** 값 하나를 store 로 만듭니다.
 *
 * ## 왜 원시로 빼는가
 *
 * 여덟 컴포넌트가 각자 `eventBus.on(...)` 을 걸고 지역 상태에 옮겨 담고 있었고,
 * 그때마다 같은 것을 다시 정했습니다 — 어느 단계(`on`/`after`)로 들을지, 초기값을
 * 무엇으로 둘지, 해제를 어디서 할지. 한 곳에 두면 규약이 하나입니다.
 *
 * ## `readable` 의 계약이 버스와 맞습니다
 *
 * - `start` 는 **첫 구독자**가 붙을 때 돕니다 → 그때 구독을 겁니다
 * - 돌려준 함수는 **마지막 구독자**가 떠날 때 돕니다 → 그게 버스의 해제 함수입니다
 *
 * 그래서 아무도 안 보는 store 는 구독조차 걸지 않습니다. 묶음
 * (`editor-state.ts`)이 store 를 통째로 만들어 둬도 비용이 없는 이유입니다.
 *
 * ## `readNow` — 버스에 지금 값이 없어서 있습니다
 *
 * 버스는 밀어 주기만 하고 마지막 값을 안 들고 있습니다. 구독을 늦게 시작하면
 * 다음 이벤트가 올 때까지 아무것도 모릅니다. 코어에 물어볼 길이 있는 값은
 * `readNow` 로 첫 구독 때 한 번 읽고, 없으면 `initial` 로 시작합니다.
 */
export function fromBus<E extends string, T>(
  editor: EditorContext,
  event: E,
  phase: EventPhase,
  project: (payload: PayloadOf<E>) => T,
  initial: T,
  readNow?: () => T
): Readable<T> {
  return readable(initial, (set) => {
    if (readNow) set(readNow())

    return editor.eventBus.on(event, phase, (payload) => set(project(payload)))
  })
}
