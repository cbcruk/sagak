import type { Readable } from 'svelte/store'
import { HistoryEvents, historyDepthOf } from 'sagak-core'
import type { EditorContext } from 'sagak-core'
import { fromState } from './from-state'

/**
 * 실행 취소·다시 실행.
 *
 * ## 왜 컴포넌트 밖인가
 *
 * `HistoryButtons` 가 실제로 필요한 것은 불리언 둘과 의도 둘입니다. 구독을
 * 컴포넌트 안에 두면 `editor: EditorContext` 를 받아야 하고, 그러면 서명이
 * "에디터 전부를 달라"가 되어 무엇에 기대는지가 안 보입니다.
 *
 * ## 지금 값이 없던 자리
 *
 * 예전에는 버스가 밀어 주는 값을 받았고, 버스에는 **지금 값이 없었습니다.**
 * 마운트 시점에는 둘 다 꺼짐이 맞으니 문제가 아니라고 적어 뒀지만, 툴바가
 * 에디터보다 늦게 붙는 구성이 생기면 틀리는 자리이기도 했습니다.
 *
 * 이제 문서 상태에서 되돌리기 깊이를 바로 읽습니다 — 언제 묻든 지금 값입니다.
 */
export interface HistoryState {
  canUndo: boolean
  canRedo: boolean
}

export interface HistoryCommands {
  undo: () => void
  redo: () => void
}

const NOTHING: HistoryState = { canUndo: false, canRedo: false }

export function historyStore(editor: EditorContext): Readable<HistoryState> {
  return fromState(
    editor,
    () => {
      const depth = historyDepthOf(editor)

      return { canUndo: depth.canUndo, canRedo: depth.canRedo }
    },
    NOTHING
  )
}

/**
 * 되돌리기·다시 하기는 **상태가 아니라 명령**이라 store 가 아닙니다.
 *
 * 들고 있을 값이 없으니 버스로 보내는 함수입니다.
 */
export function historyCommands(editor: EditorContext): HistoryCommands {
  return {
    undo: () => editor.eventBus.emit(HistoryEvents.UNDO),
    redo: () => editor.eventBus.emit(HistoryEvents.REDO),
  }
}
