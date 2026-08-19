import type { Readable } from 'svelte/store'
import { isInTableOf } from 'sagak-core'
import type { EditorContext } from 'sagak-core'
import { fromState } from './from-state'

/**
 * 캐럿이 표 안에 있습니까 — **다이얼로그의 두 얼굴을 가르는 값**입니다.
 *
 * 표 밖이면 "만들기", 안이면 "고치기"로 제목과 `aria-label` 까지 갈립니다.
 * 다이얼로그가 닫혀 있을 때도 봐야 합니다 — 툴바 버튼의 켜짐 표시가 같은 값을
 * 씁니다.
 *
 * `prosemirror-tables` 의 `isInTable` 이 답합니다 — 셀 병합까지 아는 쪽입니다.
 */
export function tableStore(editor: EditorContext): Readable<boolean> {
  return fromState(editor, () => isInTableOf(editor), false)
}
