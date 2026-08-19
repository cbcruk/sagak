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
    let last = read()
    set(last)

    return subscribeToModel(editor, () => {
      const next = read()

      /*
       * **같으면 안 알립니다.**
       *
       * 밀어 주던 시절에는 코어가 값을 비교해 바뀔 때만 쐈습니다
       * (`FORMATTING_STATE_CHANGED`). 당겨 오는 지금은 트랜잭션마다 다시
       * 읽으므로 그 비교가 여기로 옵니다 — 안 하면 글자 하나 칠 때마다
       * 툴바가 통째로 다시 그려집니다. 값이 객체라 참조 비교로는 늘 다릅니다.
       */
      if (same(last, next)) return

      last = next
      set(next)
    })
  })
}

/** 한 겹만 봅니다 — 여기 오는 값은 원시값이거나 평평한 객체입니다 */
function same<T>(a: T, b: T): boolean {
  if (Object.is(a, b)) return true

  if (
    typeof a !== 'object' ||
    typeof b !== 'object' ||
    a === null ||
    b === null
  ) {
    return false
  }

  const keys = Object.keys(a) as Array<keyof T>

  return (
    keys.length === Object.keys(b).length &&
    keys.every((key) => Object.is(a[key], b[key]))
  )
}
