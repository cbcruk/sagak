import type { EditorState, Transaction } from 'prosemirror-state'
import type { CommandRegistry } from '@/core/command-registry'
import { sagakSchema } from './schema'
import {
  commands,
  createLink,
  removeLink,
  isMarkActive,
  markValue,
  blockAttr,
  type Command,
} from './commands'
import { linkAt } from './selection'

/**
 * 2a 의 커맨드를 **커맨드 레지스트리에 얹는 자리**입니다.
 *
 * 레지스트리는 이미 precedence 체인을 갖고 있습니다 — 높은 것부터 시도하고
 * 처리하면 멈춥니다. `execCommand` 위임이 최하위(`-100`)에 있고 자체 구현이
 * `0` 에 있으니, 모델 커맨드는 그보다 위에 얹습니다.
 *
 * 그래서 갈아타기가 **한 줄짜리 사건**이 됩니다. 뷰가 붙어 상태를 내주기
 * 시작하면 모델 커맨드가 먼저 잡고, 그 전까지는 `null` 을 돌려주므로 아래
 * 층이 지금까지 하던 대로 합니다.
 */
export const MODEL_PRECEDENCE = 100

/**
 * 지금 편집 상태를 내주는 창구.
 *
 * `EditorView` 를 직접 받지 않는 이유는 **코어가 뷰를 몰라도 되기 때문**입니다.
 * 상태를 읽고 트랜잭션을 보내는 두 가지만 있으면 커맨드가 돕니다 — 검사에서는
 * 뷰 없이 이 창구만 흉내 내면 됩니다.
 */
export interface StateHandle {
  /** 아직 준비 전이면 `null` — 그때는 아래 precedence 가 맡습니다 */
  getState: () => EditorState | null
  dispatch: (tr: Transaction) => void
}

const marks = sagakSchema.marks

/**
 * `formatBlock` — 제목과 문단.
 *
 * 값이 `'<h2>'` 같은 꼴로 옵니다. `execCommand` 시절의 계약이라 그대로 받고,
 * 여기서 모델 커맨드로 옮깁니다. 이 이름이 모델에 없던 동안 **제목만 아래
 * 층으로 새어 나가고 있었습니다** — 툴바 커맨드 중 마지막 하나였습니다.
 */
function formatBlock(value: string): Command {
  const tag = value.replace(/[<>]/g, '').toLowerCase()
  const heading = /^h([1-6])$/.exec(tag)

  if (heading) {
    return commands.heading(Number(heading[1]))
  }

  if (tag === 'p' || tag === 'div') {
    return commands.paragraph
  }

  /* 모르는 태그는 처리하지 않습니다 */
  return () => false
}

/** 값을 받는 커맨드들 — 인자가 없으면 아무것도 안 합니다 */
const WITH_VALUE: Record<string, (value: string) => Command> = {
  fontName: commands.fontName,
  fontSize: commands.fontSize,
  foreColor: commands.foreColor,
  backColor: commands.backColor,
  letterSpacing: commands.letterSpacing,
  lineHeight: commands.lineHeight,
  createLink,
  formatBlock,
}

const PLAIN: Record<string, Command> = {
  bold: commands.bold,
  italic: commands.italic,
  underline: commands.underline,
  strikeThrough: commands.strikeThrough,
  subscript: commands.subscript,
  superscript: commands.superscript,
  justifyLeft: commands.justifyLeft,
  justifyCenter: commands.justifyCenter,
  justifyRight: commands.justifyRight,
  justifyFull: commands.justifyFull,
  indent: commands.indent,
  outdent: commands.outdent,
  insertUnorderedList: commands.insertUnorderedList,
  insertOrderedList: commands.insertOrderedList,
  insertHorizontalRule: commands.insertHorizontalRule,
  unlink: removeLink,
}

/** 툴바의 눌림 표시가 보는 것들 */
const STATE_QUERIES: Record<string, (state: EditorState) => boolean> = {
  bold: (state) => isMarkActive(state, marks.strong),
  italic: (state) => isMarkActive(state, marks.em),
  underline: (state) => isMarkActive(state, marks.underline),
  strikeThrough: (state) => isMarkActive(state, marks.strikethrough),
  subscript: (state) => isMarkActive(state, marks.subscript),
  superscript: (state) => isMarkActive(state, marks.superscript),
  justifyLeft: (state) => blockAttr(state, 'align') === 'left',
  justifyCenter: (state) => blockAttr(state, 'align') === 'center',
  justifyRight: (state) => blockAttr(state, 'align') === 'right',
  justifyFull: (state) => blockAttr(state, 'align') === 'justify',
  createLink: (state) => !!linkAt(state),
}

/**
 * 툴바의 셀렉트가 보는 것들.
 *
 * **`undefined` 를 돌려주는 것이 뜻이 있습니다.** 문서에 그 값이 안 걸려 있다는
 * 뜻이고, 그러면 아래 precedence 로 넘어가 **화면에 실제로 그려진 값**이
 * 답합니다 (`native-query.ts` 의 `getComputedStyle`).
 *
 * 글자 크기가 그렇습니다. 서식 없는 글은 스타일시트가 정한 15px 로 그려지는데
 * 모델에는 그런 마크가 없습니다. 여기서 빈 문자열을 주면 툴바가 기본값을
 * 가리켜, **가장 흔한 경우가 가장 크게 틀립니다.**
 */
const VALUE_QUERIES: Record<
  string,
  (state: EditorState) => string | undefined
> = {
  fontName: (state) => markValue(state, marks.fontFamily),
  fontSize: (state) => markValue(state, marks.fontSize),
  fontSizeCss: (state) => markValue(state, marks.fontSize),
  foreColor: (state) => markValue(state, marks.textColor),
  backColor: (state) => markValue(state, marks.backgroundColor),
  letterSpacing: (state) => markValue(state, marks.letterSpacing),
  lineHeight: (state) => blockAttr(state, 'lineHeight') ?? undefined,
}

/**
 * 모델 커맨드를 등록하고, 전부 해제하는 함수를 돌려줍니다.
 *
 * 상태가 `null` 이면 **`undefined` 를 돌려줍니다** — 레지스트리의 규약상
 * "처리하지 않았다" 는 뜻이고, 다음 precedence 로 넘어갑니다. 뷰가 붙기 전에도
 * 등록해 둘 수 있는 이유입니다.
 */
export function registerModelCommands(
  registry: CommandRegistry,
  handle: StateHandle
): () => void {
  const unsubs: Array<() => void> = []

  const runner =
    (command: Command) =>
    (): boolean | undefined => {
      const state = handle.getState()
      if (!state) return undefined

      return command(state, handle.dispatch)
    }

  for (const [name, command] of Object.entries(PLAIN)) {
    unsubs.push(registry.register(name, runner(command), MODEL_PRECEDENCE))
  }

  for (const [name, make] of Object.entries(WITH_VALUE)) {
    unsubs.push(
      registry.register(
        name,
        (_ctx, value) => {
          const state = handle.getState()
          if (!state || value === undefined) return undefined

          return make(value)(state, handle.dispatch)
        },
        MODEL_PRECEDENCE
      )
    )
  }

  for (const [name, query] of Object.entries(STATE_QUERIES)) {
    unsubs.push(
      registry.registerStateQuery(
        name,
        () => {
          const state = handle.getState()

          return state ? query(state) : undefined
        },
        MODEL_PRECEDENCE
      )
    )
  }

  for (const [name, query] of Object.entries(VALUE_QUERIES)) {
    unsubs.push(
      registry.registerValueQuery(
        name,
        () => {
          const state = handle.getState()

          return state ? query(state) : undefined
        },
        MODEL_PRECEDENCE
      )
    )
  }

  return () => {
    for (const off of unsubs) off()
  }
}
