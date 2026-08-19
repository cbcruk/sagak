import type { ImageAttrs } from '@/model/commands'

/**
 * **커맨드마다 어떤 값을 받는가.**
 *
 * 이벤트 맵(`event-map.ts`)이 하던 일을 커맨드 쪽에서 받습니다. 이름과 값이
 * 짝이 맞는지 컴파일러가 봐 주는 것이 요지입니다 — `run('fontName')` 처럼
 * 값을 빠뜨리거나 `run('bold', 'x')` 처럼 없는 값을 주면 거기서 걸립니다.
 *
 * ## 왜 필요해졌나
 *
 * 서명이 `run(name: string, value?: string)` 이었습니다. 문자열 하나로 끝나는
 * 커맨드에는 맞았지만, 표는 `{rows, cols}` 를 받고 이미지는 속성 넷을
 * 받습니다. 그래서 그런 것들만 버스로 남아 **층이 둘**이었습니다.
 *
 * 값의 모양을 여기 적으면 그 이유가 없어집니다.
 */
export interface CommandMap {
  /* 인라인 토글 — 값이 없습니다 */
  bold: void
  italic: void
  underline: void
  strikeThrough: void
  subscript: void
  superscript: void

  /* 값이 붙는 마크 */
  fontName: string
  fontSize: string
  foreColor: string
  backColor: string
  letterSpacing: string

  /* 문단 */
  formatBlock: string
  lineHeight: string
  justifyLeft: void
  justifyCenter: void
  justifyRight: void
  justifyFull: void
  indent: void
  outdent: void

  /* 목록 */
  insertUnorderedList: void
  insertOrderedList: void

  /* 되돌리기 — 문서를 고치는 일이라 다른 커맨드와 같은 문으로 들어옵니다 */
  undo: void
  redo: void

  /* 넣기 */
  insertHorizontalRule: void
  insertText: string
  createLink: string
  unlink: void

  /* 구조 있는 값 — 예전에는 이것들 때문에 버스가 남아 있었습니다 */
  insertTable: { rows: number; cols: number }
  addRowBefore: void
  addRowAfter: void
  deleteRow: void
  addColumnBefore: void
  addColumnAfter: void
  deleteColumn: void
  deleteTable: void

  insertImage: ImageAttrs
  updateImage: Partial<ImageAttrs>
  deleteImage: void
}

export type CommandName = keyof CommandMap

/** 그 커맨드에 값이 있으면 그 타입, 없으면 아무것도 아님 */
export type CommandArgs<K extends CommandName> = CommandMap[K] extends void
  ? []
  : [value: CommandMap[K]]

/**
 * 조회할 수 있는 것들 — 눌림 표시와 셀렉트가 봅니다.
 *
 * 실행과 조회가 갈리는 이유는 **묻는 것이 다르기** 때문입니다. `justifyCenter`
 * 는 실행도 조회도 되지만 `insertTable` 은 실행만 됩니다.
 */
export type StateQueryName =
  | 'bold'
  | 'italic'
  | 'underline'
  | 'strikeThrough'
  | 'subscript'
  | 'superscript'
  | 'justifyLeft'
  | 'justifyCenter'
  | 'justifyRight'
  | 'justifyFull'
  | 'createLink'

export type ValueQueryName =
  | 'fontName'
  | 'fontSize'
  | 'fontSizeCss'
  | 'foreColor'
  | 'backColor'
  | 'letterSpacing'
  | 'lineHeight'
