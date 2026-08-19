import type { Readable } from 'svelte/store'
import { linkOf } from 'sagak-core'
import type { EditorContext } from 'sagak-core'
import { fromState } from './from-state'

/**
 * 캐럿이 링크 위에 있습니까.
 *
 * 링크 요소가 아니라 **불리언**을 담습니다. 다이얼로그는 열 때와 지울 때 주소가
 * 필요하지만 그건 그 순간에 다시 물으면 되고, 선택이 움직일 때마다 값을 들고
 * 있으면 이미 문서에서 떨어져 나간 것을 붙들게 됩니다.
 */
export function linkStore(editor: EditorContext): Readable<boolean> {
  return fromState(editor, () => !!linkOf(editor), false)
}
