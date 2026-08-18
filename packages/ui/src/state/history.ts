import type { Readable } from 'svelte/store'
import { HistoryEvents } from 'sagak-core'
import type { EditorContext } from 'sagak-core'
import { fromBus } from './from-bus'

/**
 * 실행 취소·다시 실행.
 *
 * ## 왜 컴포넌트 밖인가
 *
 * `HistoryButtons` 가 실제로 필요한 것은 불리언 둘과 의도 둘입니다. 구독을
 * 컴포넌트 안에 두면 `editor: EditorContext` 를 받아야 하고, 그러면 서명이
 * "에디터 전부를 달라"가 되어 무엇에 기대는지가 안 보입니다.
 *
 * Toolbar 로 올리지 않는 이유도 같습니다 — 툴바가 구독 여덟 개를 들면 저장소에서
 * 제일 무거운 파일이 됩니다. 상태는 여기, 툴바는 잇기만 합니다.
 *
 * ## 지금 값이 없습니다
 *
 * `fromBus` 의 `readNow` 를 안 씁니다 — `HistoryManager` 가 히스토리 플러그인의
 * 클로저 안이라 물어볼 길이 없습니다. 마운트 시점에는 둘 다 꺼짐이 맞으므로
 * 지금은 문제가 아니지만, 툴바가 에디터보다 늦게 붙는 구성이 생기면 그때는
 * 코어가 `historyManager` 를 컨텍스트에 내주거나 버스가 마지막 값을 들어야
 * 합니다.
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
  return fromBus(
    editor,
    HistoryEvents.HISTORY_STATE_CHANGED,
    'after',
    (state) => ({ canUndo: state.canUndo, canRedo: state.canRedo }),
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
