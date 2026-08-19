import type { Readable } from 'svelte/store'
import { listKindOf } from 'sagak-core'
import type { EditorContext, ListKind } from 'sagak-core'
import { fromState } from './from-state'
import { exec } from './exec'

/**
 * 캐럿이 놓인 목록의 종류 — 없으면 `'none'` 입니다.
 *
 * 버튼의 켜짐 표시와 아이콘(글머리/번호)이 이 값을 같이 씁니다. 문서 구조에서
 * 직접 읽으므로 `<li>` 를 어떻게 그리든(안에 `<p>` 가 있든) 흔들리지 않습니다.
 */
export type ListType = ListKind

export interface ListCommands {
  unordered: () => void
  ordered: () => void
}

export function listStore(editor: EditorContext): Readable<ListType> {
  return fromState(editor, () => listKindOf(editor), 'none')
}

export function listCommands(editor: EditorContext): ListCommands {
  return {
    unordered: () => void exec(editor, 'insertUnorderedList'),
    ordered: () => void exec(editor, 'insertOrderedList'),
  }
}
