import { readable } from 'svelte/store'
import type { Readable } from 'svelte/store'
import type { EditorContext } from 'sagak-core'
import { subscribeToSelection } from './selection'

/**
 * 선택이 바뀔 때마다 **다시 읽는** 값을 store 로 만듭니다.
 *
 * ## `fromBus` 와 반대쪽입니다
 *
 * 버스가 밀어 주는 값이 아니라, 선택이 움직였다는 신호에 우리가 문서를 다시
 * 읽어 만드는 값입니다 — 지금 문단의 정렬, 캐럿이 표 안인지, 링크 위인지.
 *
 * ## 가드는 여기서 만들지 않습니다
 *
 * `subscribeToSelection` 을 반드시 통과합니다. IME 조합 중 무시·다음 프레임까지
 * 지연·선택이 에디터 밖이면 건너뜀 — 이 셋이 거기 한 벌만 있고, 여기서 지름길을
 * 내면 `selection.ts` 첫머리가 경고하는 "여섯 곳이 제각각이던" 자리로
 * 돌아갑니다.
 *
 * ## `initial` 은 아무도 안 보는 값입니다
 *
 * `readable` 이 초기값을 요구해서 받을 뿐입니다. 첫 구독자가 붙으면 `start` 가
 * **동기로** `read()` 를 넣고, 구독자는 그 뒤에 값을 받으므로 첫 렌더부터 진짜
 * 값을 봅니다. 반대로 아무도 안 보는 store 는 `read()` 를 한 번도 안 합니다 —
 * 묶음(`editor-state.ts`)이 store 를 통째로 만들어 둬도 DOM 을 안 건드리는
 * 이유입니다.
 *
 * 첫 읽기에는 "에디터 밖이면 건너뜀" 가드를 걸지 않습니다. 옮겨 오기 전 여섯
 * 컴포넌트가 전부 마운트 때 무조건 한 번 읽었고, 그 동작을 그대로 둡니다.
 */
export function fromSelection<T>(
  editor: EditorContext,
  read: () => T,
  initial: T
): Readable<T> {
  return readable(initial, (set) => {
    set(read())

    return subscribeToSelection(editor, () => set(read()))
  })
}
