import type { EditorState } from 'prosemirror-state'
import { isInTable } from 'prosemirror-tables'
import { sagakSchema } from './schema'
import { blockAttr, imageAt } from './commands'

/**
 * **선택이 지금 무엇 위에 있는가** — 툴바가 묻는 것들.
 *
 * 예전에는 이 답들을 UI 가 직접 구했습니다. `window.getSelection()` 으로
 * 캐럿을 잡고 `parentNode` 를 타고 올라가며 `TABLE`·`OL`·`A` 태그를 찾고,
 * 정렬은 `getComputedStyle(...).textAlign` 을 읽었습니다.
 *
 * 그 방식에는 두 가지 문제가 있었습니다.
 *
 * 1. **DOM 이 진실이라는 전제** — 이제 진실은 모델이고, DOM 은 그것을 그린
 *    것입니다. 그리는 방식이 바뀌면(`<li><p>`) 답이 흔들립니다.
 * 2. **어느 에디터인지 모름** — 순수 함수라 `document` 전역을 봤고, 한 페이지에
 *    에디터가 둘이면 어느 쪽 선택인지 가릴 수 없었습니다. 그래서 구독 쪽
 *    (`subscribeToSelection`)이 "선택이 이 에디터 안인가" 가드를 따로 들고
 *    있어야 했습니다.
 *
 * 모델에 물으면 둘 다 없습니다. 상태가 곧 그 에디터의 것이고, 답은 문서 구조
 * 자체입니다.
 */

export type Alignment = 'left' | 'center' | 'right' | 'justify'
export type ListKind = 'ordered' | 'unordered' | 'none'

export interface LinkFacts {
  href: string
  title: string | null
}

export interface ImageFacts {
  src: string
  alt: string | null
  width: string | null
  height: string | null
}

/** 지금 문단의 정렬 — 안 정해져 있으면 `'left'` 입니다 */
export function alignmentAt(state: EditorState): Alignment {
  return (blockAttr(state, 'align') as Alignment | null) ?? 'left'
}

/** 캐럿이 놓인 목록의 종류 */
export function listKindAt(state: EditorState): ListKind {
  const { $from } = state.selection

  for (let depth = $from.depth; depth > 0; depth -= 1) {
    const name = $from.node(depth).type.name

    if (name === 'ordered_list') return 'ordered'
    if (name === 'bullet_list') return 'unordered'
  }

  return 'none'
}

/**
 * 캐럿이 놓인 링크.
 *
 * 요소가 아니라 **값**을 돌려줍니다. 예전에는 `HTMLAnchorElement` 를 돌려줬는데,
 * 그걸 들고 있으면 문서가 다시 그려진 뒤 이미 떨어져 나간 노드를 붙들게 됩니다.
 */
export function linkAt(state: EditorState): LinkFacts | null {
  const { $from, empty, from, to } = state.selection
  const type = sagakSchema.marks.link

  const mark =
    type.isInSet($from.marks()) ??
    (empty ? undefined : type.isInSet(state.doc.resolve(from).marks()))

  if (mark) {
    return {
      href: mark.attrs.href as string,
      title: (mark.attrs.title as string | null) ?? null,
    }
  }

  /* 링크 전체를 고른 경우 — 시작점의 마크가 안 잡힐 수 있습니다 */
  if (!empty) {
    let found: LinkFacts | null = null

    state.doc.nodesBetween(from, to, (node) => {
      if (found || !node.isText) return !found

      const inline = type.isInSet(node.marks)

      if (inline) {
        found = {
          href: inline.attrs.href as string,
          title: (inline.attrs.title as string | null) ?? null,
        }
      }

      return !found
    })

    return found
  }

  return null
}

/** 지금 다루고 있는 이미지의 속성 */
export function imageFactsAt(state: EditorState): ImageFacts | null {
  const found = imageAt(state)

  if (!found) return null

  const attrs = found.node.attrs as Record<string, string | null>

  return {
    src: attrs.src ?? '',
    alt: attrs.alt ?? null,
    width: attrs.width ?? null,
    height: attrs.height ?? null,
  }
}

/**
 * 캐럿이 얹힌 링크가 차지한 **범위**.
 *
 * 링크를 벗기려면 캐럿 한 점이 아니라 링크 전체가 필요합니다. 예전에는 UI 가
 * `<a>` 요소를 찾아 DOM 선택을 그 위로 넓혀 놓고 명령을 불렀는데, 그건 선택을
 * 바꾸는 부수효과였고 사용자에게도 보였습니다.
 */
export function linkRangeAt(
  state: EditorState
): { from: number; to: number } | null {
  const type = sagakSchema.marks.link
  const { $from, from, to } = state.selection

  const mark = type.isInSet($from.marks())

  if (mark) {
    /* 같은 링크가 이어지는 데까지 좌우로 넓힙니다 */
    let start = $from.pos
    let end = $from.pos
    const parent = $from.parent
    const offset = $from.parentOffset
    const base = $from.pos - offset

    let at = 0
    parent.forEach((child, childOffset) => {
      const childStart = base + childOffset
      const childEnd = childStart + child.nodeSize

      if (!type.isInSet(child.marks)) return
      if (childEnd <= start && at > 0) return

      if (childStart <= $from.pos && $from.pos <= childEnd) {
        start = childStart
        end = childEnd
        at += 1
      }
    })

    if (start !== end) return { from: start, to: end }
  }

  /* 고른 범위 안에 링크가 있으면 그 자리 */
  let found: { from: number; to: number } | null = null

  state.doc.nodesBetween(from, to, (node, pos) => {
    if (found || !node.isText) return !found

    if (type.isInSet(node.marks)) {
      found = { from: pos, to: pos + node.nodeSize }
    }

    return !found
  })

  return found
}

/** 캐럿이 표 안입니까 */
export function isCaretInTable(state: EditorState): boolean {
  return isInTable(state)
}
