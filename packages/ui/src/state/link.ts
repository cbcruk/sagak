import type { Readable } from 'svelte/store'
import type { EditorContext } from 'sagak-core'
import { fromSelection } from './from-selection'
import { getSelectedLink } from '../components/link-dialog/link-dialog.shared'

/**
 * 캐럿이 링크 위에 있습니까.
 *
 * 링크 요소 자체가 아니라 **불리언**을 담습니다. 다이얼로그는 열 때와 지울 때
 * 그 요소가 필요하지만 그건 클릭 순간에 다시 찾으면 되고, 선택이 움직일 때마다
 * 요소를 store 에 들고 있으면 이미 문서에서 떨어져 나간 노드를 붙들게 됩니다.
 */
export function linkStore(editor: EditorContext): Readable<boolean> {
  return fromSelection(editor, () => !!getSelectedLink(), false)
}
