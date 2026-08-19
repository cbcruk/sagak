import { readable } from 'svelte/store'
import type { Readable } from 'svelte/store'
import { subscribeToModel } from 'sagak-core'
import type { EditorContext } from 'sagak-core'

/**
 * 문서 상태가 바뀔 때마다 **다시 읽는** 값을 store 로 만듭니다.
 *
 * ## `fromSelection` 을 대신합니다
 *
 * 예전 것은 `document` 의 `selectionchange` 를 듣고 DOM 을 다시 걸었습니다.
 * 그러려면 가드가 셋 필요했습니다 — IME 조합 중 무시, 다음 프레임까지 지연,
 * 선택이 에디터 밖이면 건너뜀.
 *
 * **셋 다 없어졌습니다.** 셋 다 "DOM 이 지금 믿을 만한가" 를 묻는 것이었는데,
 * 이제 묻는 대상이 문서 모델입니다. 조합 중에는 `prosemirror-view` 가
 * 트랜잭션을 안 만들고, 트랜잭션이 왔다는 것은 이미 확정된 상태이며, 그
 * 상태는 애초에 이 에디터의 것입니다.
 *
 * ## `initial` 은 아무도 안 보는 값입니다
 *
 * `readable` 이 초기값을 요구해서 받을 뿐입니다. 첫 구독자가 붙으면 `start` 가
 * **동기로** `read()` 를 넣습니다. 반대로 아무도 안 보는 store 는 `read()` 를
 * 한 번도 안 합니다 — 묶음(`editor-state.ts`)이 store 를 통째로 만들어 둬도
 * 비용이 없는 이유입니다.
 */
export function fromState<T>(
  editor: EditorContext,
  read: () => T,
  initial: T
): Readable<T> {
  return readable(initial, (set) => {
    set(read())

    return subscribeToModel(editor, () => set(read()))
  })
}
