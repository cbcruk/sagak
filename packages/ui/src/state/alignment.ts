import type { Readable } from 'svelte/store'
import { ParagraphEvents } from 'sagak-core'
import type { EditorContext } from 'sagak-core'
import { fromSelection } from './from-selection'
import {
  getCurrentAlignment,
  type AlignmentType,
} from '../components/alignment-buttons/alignment-buttons.shared'

/**
 * 지금 문단의 정렬 — 선택에서 읽는 값입니다.
 *
 * `getCurrentAlignment()` 은 문서에서 직접 읽으므로 `editor` 를 안 받습니다.
 * 어느 에디터의 선택인지는 `fromSelection` 이 가려 줍니다.
 */
export interface AlignmentCommands {
  align: (align: AlignmentType) => void
}

export function alignmentStore(
  editor: EditorContext
): Readable<AlignmentType> {
  return fromSelection(editor, getCurrentAlignment, 'left')
}

export function alignmentCommands(editor: EditorContext): AlignmentCommands {
  return {
    align: (align) =>
      editor.eventBus.emit(ParagraphEvents.ALIGNMENT_CHANGED, { align }),
  }
}
