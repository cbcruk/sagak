import { toggleMark, setBlockType } from 'prosemirror-commands'
import { wrapInList, liftListItem } from 'prosemirror-schema-list'
import {
  addRowBefore,
  addRowAfter,
  deleteRow,
  addColumnBefore,
  addColumnAfter,
  deleteColumn,
  deleteTable,
  isInTable,
} from 'prosemirror-tables'
import { NodeSelection, TextSelection } from 'prosemirror-state'
import type { EditorState, Transaction } from 'prosemirror-state'
import type { MarkType, Node as PMNode, NodeType } from 'prosemirror-model'
import { sagakSchema } from './schema'
import { linkRangeAt } from './selection'

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

  /*
   * 표는 `prosemirror-tables` 가 줍니다 — 셀 병합·열 너비까지 이미 아는
   * 커맨드들이라 우리가 다시 지을 것이 없습니다.
   */
  addRowBefore,
  addRowAfter,
  deleteRow,
  addColumnBefore,
  addColumnAfter,
  deleteColumn,
  deleteTable,
}

/** 지금 캐럿이 표 안에 있는가 — 툴바가 "삽입" 과 "편집" 을 가르는 데 씁니다 */
export { isInTable }

/**
 * 표를 넣습니다.
 *
 * 예전에는 `document.createElement('table')` 로 만들어 `range.insertNode` 로
 * 꽂았습니다. 그러면 문단 **안에** `<table>` 이 들어가는 꼴이 되고, 스키마를
 * 지나며 통째로 사라집니다. 모델에서는 애초에 그런 자리에 못 놓습니다.
 */
export function insertTable(rows: number, cols: number): Command {
  return (state, dispatch) => {
    const row = () =>
      nodes.table_row.create(
        null,
        Array.from({ length: cols }, () => nodes.table_cell.createAndFill()!)
      )

    const table = nodes.table.create(
      null,
      Array.from({ length: rows }, row)
    )

    if (dispatch) {
      const at = state.selection.from
      const tr = state.tr.replaceSelectionWith(table)

      /*
       * 캐럿을 **첫 칸 안에** 둡니다.
       *
       * 그냥 넣으면 선택이 표 뒤에 남아, 표를 만들자마자 친 글자가 표 밑에
       * 붙습니다. `near` 가 그 자리에서 앞으로 훑어 글을 쓸 수 있는 첫 자리를
       * 찾아 줍니다.
       */
      dispatch(
        tr.setSelection(TextSelection.near(tr.doc.resolve(at))).scrollIntoView()
      )
    }

    return true
  }
}

export interface ImageAttrs {
  src: string
  alt?: string | null
  width?: string | null
  height?: string | null
}

/**
 * 지금 다루고 있는 이미지.
 *
 * 이미지를 통째로 고른 경우(`NodeSelection`)와 캐럿이 이미지 바로 옆에 있는
 * 경우를 함께 봅니다 — 예전 `findImageAtSelection` 이 DOM 에서 하던
 * "커서 앞뒤의 `<img>`" 와 같은 짐작이되, 자리가 정확합니다.
 */
export function imageAt(
  state: EditorState
): { pos: number; node: PMNode } | null {
  const selection = state.selection

  if (
    selection instanceof NodeSelection &&
    selection.node.type === nodes.image
  ) {
    return { pos: selection.from, node: selection.node }
  }

  const { $from } = selection
  const before = $from.nodeBefore

  if (before?.type === nodes.image) {
    return { pos: $from.pos - before.nodeSize, node: before }
  }

  const after = $from.nodeAfter

  if (after?.type === nodes.image) {
    return { pos: $from.pos, node: after }
  }

  return null
}

/** 이미지의 속성을 고칩니다 — 준 것만 바꿉니다 */
export function updateImage(attrs: Partial<ImageAttrs>): Command {
  return (state, dispatch) => {
    const found = imageAt(state)

    if (!found) return false

    if (dispatch) {
      dispatch(
        state.tr.setNodeMarkup(found.pos, undefined, {
          ...found.node.attrs,
          ...attrs,
        })
      )
    }

    return true
  }
}

/** 이미지를 지웁니다 */
export const deleteImage: Command = (state, dispatch) => {
  const found = imageAt(state)

  if (!found) return false

  if (dispatch) {
    dispatch(state.tr.delete(found.pos, found.pos + found.node.nodeSize))
  }

  return true
}

/** 고른 자리에 글자를 넣습니다 — 고른 범위가 있으면 덮어씁니다 */
export function insertText(text: string): Command {
  return (state, dispatch) => {
    if (dispatch) {
      dispatch(state.tr.insertText(text).scrollIntoView())
    }

    return true
  }
}

/**
 * 고른 글을 링크로 만듭니다.
 *
 * 캐럿만 있으면 아무것도 안 합니다 — 링크는 범위가 있어야 하는 마크입니다.
 */
export function createLink(href: string): Command {
  return (state, dispatch) => {
    const { from, to, empty } = state.selection

    if (empty) return false

    if (dispatch) {
      dispatch(
        state.tr
          .removeMark(from, to, marks.link)
          .addMark(from, to, marks.link.create({ href, title: null }))
      )
    }

    return true
  }
}

/**
 * 링크를 벗깁니다 — **캐럿만 얹혀 있어도 됩니다.**
 *
 * 링크가 차지한 범위를 스스로 찾습니다. 예전에는 부르는 쪽(다이얼로그)이
 * DOM 선택을 링크 전체로 넓혀 놓아야 했고, 그 넓힌 선택이 사용자에게도
 * 보였습니다.
 */
export const removeLink: Command = (state, dispatch) => {
  const range = linkRangeAt(state)

  if (!range) return false

  if (dispatch) {
    dispatch(state.tr.removeMark(range.from, range.to, marks.link))
  }

  return true
}

/** 이미지를 넣습니다 — 크기는 속성이고, 화면에 붙는 것은 스타일입니다 */
export function insertImage(attrs: ImageAttrs): Command {
  return (state, dispatch) => {
    if (dispatch) {
      dispatch(
        state.tr.replaceSelectionWith(
          nodes.image.create({
            src: attrs.src,
            alt: attrs.alt ?? null,
            width: attrs.width ?? null,
            height: attrs.height ?? null,
          })
        )
      )
    }

    return true
  }
}
