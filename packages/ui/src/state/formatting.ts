import type { Readable } from 'svelte/store'
import { CoreEvents, TextStyleEvents } from 'sagak-core'
import type { EditorContext } from 'sagak-core'
import { fromBus } from './from-bus'
import { isSelectionInside } from './selection'

/**
 * 굵게·기울임·밑줄·취소선의 켜짐 상태.
 *
 * ## 지금 값을 코어에 물어봅니다
 *
 * 예전에는 넷 다 `false` 로 시작해 구독만 걸었습니다. 버스에 **지금 값이
 * 없어서**, 코어가 다음 `FORMATTING_STATE_CHANGED` 를 쏘기 전까지는 이미 굵은
 * 글 위에 캐럿이 있어도 툴바가 꺼짐으로 보였습니다.
 *
 * 코어가 그 값을 계산하는 방법이 `commandRegistry.queryState(...)` 라 여기서도
 * 그대로 물어봅니다 (`EditorCore.setupFormattingStateTracking`). 묻는 시점은
 * store 를 만들 때가 아니라 **첫 구독자가 붙을 때**입니다 (`fromBus` 의
 * `readNow`) — 툴바가 뜨는 순간이 아니라 실제로 보기 시작하는 순간의 값이라야
 * 맞습니다.
 *
 * 선택이 에디터 밖이면 묻지 않습니다 — `document.queryCommandState` 는 그때
 * 엉뚱한 값을 주므로, 코어와 같은 판정(`isSelectionInside`)을 먼저 통과시킵니다.
 *
 * ## 코어가 여섯을 보내지만 넷만 씁니다
 *
 * `isSubscript`·`isSuperscript` 는 툴바에 버튼이 없습니다. 쓰는 만큼만 내놓고,
 * 필요해지면 그때 늘립니다.
 */
export interface FormattingState {
  isBold: boolean
  isItalic: boolean
  isUnderline: boolean
  isStrikeThrough: boolean
}

export type FormattingCommands = {
  [K in keyof typeof TOGGLES]: () => void
}

const NOTHING: FormattingState = {
  isBold: false,
  isItalic: false,
  isUnderline: false,
  isStrikeThrough: false,
}

/*
 * 쏘는 이벤트를 **실제로 있는 넷으로 좁혀** 둡니다 — `FormatToggles` 에 있던
 * `ToggleEvent` 가 하던 일입니다. `string` 으로 두면 발행할 때 `as never` 가
 * 필요해지고, 그건 이벤트 맵의 타입 검사를 스스로 끄는 셈입니다.
 */
const TOGGLES = {
  bold: TextStyleEvents.BOLD_CLICKED,
  italic: TextStyleEvents.ITALIC_CLICKED,
  underline: TextStyleEvents.UNDERLINE_CLICKED,
  strikeThrough: TextStyleEvents.STRIKE_CLICKED,
} as const

function readNow(editor: EditorContext): FormattingState {
  const registry = editor.commandRegistry
  if (!registry || !isSelectionInside(editor)) return NOTHING

  return {
    isBold: registry.queryState('bold'),
    isItalic: registry.queryState('italic'),
    isUnderline: registry.queryState('underline'),
    isStrikeThrough: registry.queryState('strikeThrough'),
  }
}

export function formattingStore(
  editor: EditorContext
): Readable<FormattingState> {
  return fromBus(
    editor,
    CoreEvents.FORMATTING_STATE_CHANGED,
    'on',
    (next) => ({
      isBold: next.isBold,
      isItalic: next.isItalic,
      isUnderline: next.isUnderline,
      isStrikeThrough: next.isStrikeThrough,
    }),
    NOTHING,
    () => readNow(editor)
  )
}

/** 토글은 상태가 아니라 명령이라 store 밖입니다 (`historyCommands` 와 같습니다) */
export function formattingCommands(editor: EditorContext): FormattingCommands {
  return {
    bold: () => editor.eventBus.emit(TOGGLES.bold),
    italic: () => editor.eventBus.emit(TOGGLES.italic),
    underline: () => editor.eventBus.emit(TOGGLES.underline),
    strikeThrough: () => editor.eventBus.emit(TOGGLES.strikeThrough),
  }
}
