import type { Readable } from 'svelte/store'
import { ParagraphEvents } from 'sagak-core'
import type { EditorContext } from 'sagak-core'
import { fromSelection } from './from-selection'
import {
  getCurrentListType,
  type ListType,
} from '../components/list-buttons/list-buttons.shared'

/**
 * 캐럿이 놓인 목록의 종류 — 없으면 `'none'` 입니다.
 *
 * 버튼의 켜짐 표시와 아이콘(글머리/번호)이 이 값을 같이 씁니다.
 */
export interface ListCommands {
  unordered: () => void
  ordered: () => void
}

export function listStore(editor: EditorContext): Readable<ListType> {
  return fromSelection(editor, getCurrentListType, 'none')
}

export function listCommands(editor: EditorContext): ListCommands {
  return {
    unordered: () =>
      editor.eventBus.emit(ParagraphEvents.UNORDERED_LIST_CLICKED),
    ordered: () => editor.eventBus.emit(ParagraphEvents.ORDERED_LIST_CLICKED),
  }
}
