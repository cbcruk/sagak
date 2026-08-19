import type { Readable } from 'svelte/store'
import type { EditorContext } from 'sagak-core'
import { fromState } from './from-state'
import { exec } from './exec'

/**
 * 굵게·기울임·밑줄·취소선의 켜짐 상태.
 *
 * ## 밀어 주던 것을 이제 당겨 옵니다
 *
 * 예전에는 코어가 `FORMATTING_STATE_CHANGED` 를 쏘고 여기서 받았습니다. 버스에
 * **지금 값이 없어서** 첫 렌더에 쓸 값을 따로 물어야 했고(`readNow`), 그러려면
 * "선택이 에디터 안인가" 가드도 여기 한 벌 더 있어야 했습니다 —
 * `document.queryCommandState` 가 에디터 밖에서 엉뚱한 값을 주기 때문입니다.
 *
 * 상태를 당겨 오면 그 둘이 함께 없어집니다. 언제 읽든 지금 값이고, 답하는 것은
 * 모델이라 선택이 어디 있든 그 에디터의 사실입니다.
 *
 * ## 코어가 여섯을 세지만 넷만 씁니다
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
  [K in Toggle]: () => void
}

const NOTHING: FormattingState = {
  isBold: false,
  isItalic: false,
  isUnderline: false,
  isStrikeThrough: false,
}

/*
 * **이름이 곧 커맨드입니다.**
 *
 * 예전에는 `bold` 라는 개념에 이름이 둘이었습니다 — 버스의 `BOLD_CLICKED` 와
 * 커맨드의 `bold`. 그 사이를 플러그인이 이어 줬는데, 그 층이 없어지면서
 * 이름도 하나가 됐습니다.
 */
type Toggle = 'bold' | 'italic' | 'underline' | 'strikeThrough'

function read(editor: EditorContext): FormattingState {
  const registry = editor.commandRegistry

  if (!registry) return NOTHING

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
  return fromState(editor, () => read(editor), NOTHING)
}

/** 토글은 상태가 아니라 명령이라 store 밖입니다 (`historyCommands` 와 같습니다) */
export function formattingCommands(editor: EditorContext): FormattingCommands {
  return {
    bold: () => void exec(editor, 'bold'),
    italic: () => void exec(editor, 'italic'),
    underline: () => void exec(editor, 'underline'),
    strikeThrough: () => void exec(editor, 'strikeThrough'),
  }
}
