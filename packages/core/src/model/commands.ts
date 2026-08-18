import { toggleMark, setBlockType } from 'prosemirror-commands'
import { wrapInList, liftListItem } from 'prosemirror-schema-list'
import type { EditorState, Transaction } from 'prosemirror-state'
import type { MarkType, NodeType } from 'prosemirror-model'
import { sagakSchema } from './schema'

/**
 * 툴바가 부르는 일들을 **`EditorState` 위에서** 하는 커맨드로 옮깁니다.
 *
 * ## 왜 뷰보다 먼저인가
 *
 * `EditorView` 를 얹는 순간 PM 이 DOM 을 소유합니다. 그때까지도 커맨드가
 * `execCommand` 로 DOM 을 직접 고치고 있으면 **모델과 DOM 이 어긋납니다.**
 * 그래서 커맨드를 먼저 짓습니다 — 여기 있는 것들은 뷰 없이도 `EditorState`
 * 만으로 돌고 검사할 수 있어서, 뷰가 들어오기 전까지 **아무도 안 쓰는 채로
 * 완성**될 수 있습니다. 어긋나는 구간이 생기지 않습니다.
 *
 * ## 모양
 *
 * ProseMirror 의 관례를 그대로 씁니다 — `(state, dispatch?) => boolean`.
 * `dispatch` 를 안 주면 **할 수 있는지만** 답합니다. 툴바 버튼의 눌림 여부와
 * 실행이 같은 함수에서 나옵니다.
 */
export type Command = (
  state: EditorState,
  dispatch?: (tr: Transaction) => void
) => boolean

const marks = sagakSchema.marks
const nodes = sagakSchema.nodes

/** 지금 선택에 이 마크가 걸려 있는가 — 툴바의 눌림 표시가 씁니다 */
export function isMarkActive(state: EditorState, type: MarkType): boolean {
  const { from, $from, to, empty } = state.selection

  return empty
    ? !!type.isInSet(state.storedMarks || $from.marks())
    : state.doc.rangeHasMark(from, to, type)
}

/** 값이 붙는 마크의 지금 값 — 글꼴·크기·색이 씁니다 */
export function markValue(
  state: EditorState,
  type: MarkType
): string | undefined {
  const { $from, empty } = state.selection
  const set = empty ? state.storedMarks || $from.marks() : $from.marks()
  const mark = type.isInSet(set)

  return mark ? (mark.attrs.value as string) : undefined
}

/**
 * 값이 붙는 마크를 **덮어씁니다.**
 *
 * 토글이 아닙니다 — 글꼴을 Georgia 에서 Arial 로 바꾸는 것은 끄고 켜는 것이
 * 아니라 값을 바꾸는 것입니다. 그래서 있던 것을 지우고 새로 겁니다.
 */
export function setMarkValue(type: MarkType, value: string): Command {
  return (state, dispatch) => {
    const { from, to, empty } = state.selection

    if (empty) {
      /* 캐럿만 있으면 다음에 칠 글자에 걸립니다 */
      if (dispatch) {
        dispatch(state.tr.addStoredMark(type.create({ value })))
      }

      return true
    }

    if (dispatch) {
      dispatch(
        state.tr.removeMark(from, to, type).addMark(from, to, type.create({ value }))
      )
    }

    return true
  }
}

/**
 * 문단 속성을 바꿉니다 — 정렬·줄 간격·들여쓰기.
 *
 * 마크가 아니라 **블록의 속성**이라 선택이 걸친 블록마다 답니다.
 */
export function setBlockAttr(name: string, value: string | null): Command {
  return (state, dispatch) => {
    const { from, to } = state.selection
    let changed = false
    const tr = state.tr

    state.doc.nodesBetween(from, to, (node, pos) => {
      if (!node.type.isTextblock) return

      tr.setNodeMarkup(pos, undefined, { ...node.attrs, [name]: value })
      changed = true
    })

    if (changed && dispatch) dispatch(tr)

    return changed
  }
}

/** 문단 속성의 지금 값 — 선택의 첫 블록을 봅니다 */
export function blockAttr(state: EditorState, name: string): string | null {
  const { $from } = state.selection

  for (let depth = $from.depth; depth > 0; depth -= 1) {
    const node = $from.node(depth)

    if (node.type.isTextblock) return (node.attrs[name] as string) ?? null
  }

  return null
}

const heading = (level: number): Command =>
  setBlockType(nodes.heading as NodeType, { level })

/**
 * 툴바가 부르는 것들.
 *
 * 이름은 지금 커맨드 레지스트리가 쓰는 것과 맞춥니다 — 뷰가 들어올 때 같은
 * 이름으로 더 높은 precedence 에 얹으면 그대로 갈아탑니다.
 */
export const commands = {
  bold: toggleMark(marks.strong),
  italic: toggleMark(marks.em),
  underline: toggleMark(marks.underline),
  strikeThrough: toggleMark(marks.strikethrough),
  subscript: toggleMark(marks.subscript),
  superscript: toggleMark(marks.superscript),

  fontName: (value: string) => setMarkValue(marks.fontFamily, value),
  fontSize: (value: string) => setMarkValue(marks.fontSize, value),
  foreColor: (value: string) => setMarkValue(marks.textColor, value),
  backColor: (value: string) => setMarkValue(marks.backgroundColor, value),
  letterSpacing: (value: string) => setMarkValue(marks.letterSpacing, value),

  paragraph: setBlockType(nodes.paragraph as NodeType),
  heading,

  justifyLeft: setBlockAttr('align', 'left'),
  justifyCenter: setBlockAttr('align', 'center'),
  justifyRight: setBlockAttr('align', 'right'),
  justifyFull: setBlockAttr('align', 'justify'),
  lineHeight: (value: string) => setBlockAttr('lineHeight', value),

  /*
   * 들여쓰기는 단계가 아니라 **길이**입니다 — 지금 제품이 `margin-left: 40px`
   * 단위로 넣고 있어 그 값을 그대로 씁니다.
   */
  indent: setBlockAttr('indent', '40px'),
  outdent: setBlockAttr('indent', null),

  insertUnorderedList: wrapInList(nodes.bullet_list as NodeType),
  insertOrderedList: wrapInList(nodes.ordered_list as NodeType),
  removeList: liftListItem(nodes.list_item as NodeType),

  insertHorizontalRule: ((state, dispatch) => {
    if (dispatch) {
      dispatch(state.tr.replaceSelectionWith(nodes.horizontal_rule.create()))
    }

    return true
  }) as Command,
}
