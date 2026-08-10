import type { Doc, Mark, Paragraph } from './doc'

/**
 * 모델을 DOM 으로 그리고, DOM 좌표를 문서 위치로 옮깁니다.
 *
 * ## 화살표의 방향
 *
 * 1단계는 DOM 이 없었습니다. 2단계는 `contenteditable` 을 붙이되
 * **진실은 모델에 둡니다.**
 *
 * ```
 * 브라우저가 DOM 을 바꿈  →  읽음  →  변경으로 변환  →  모델에 적용  →  모델로 DOM 을 다시 맞춤
 * ```
 *
 * sagak 본체는 반대입니다 — DOM 이 진실이고 모델이 없습니다. 그래서
 * `document.execCommand` 로 브라우저에게 시키고, 결과를 나중에 읽습니다.
 *
 * ## 여기 있는 함수들이 DOM 만 보는 이유
 *
 * `domToPos` / `posToDom` 은 **모델을 인자로 받지 않습니다.** 일부러입니다.
 * 브라우저가 DOM 을 고친 직후에는 DOM 과 모델이 다르고, 그 순간의 DOM 좌표를
 * 읽어야 "무엇이 바뀌었는가" 를 알 수 있기 때문입니다. 모델을 참조하면
 * 이미 낡은 좌표계를 쓰게 됩니다.
 *
 * 그래서 이 함수들이 계산하는 위치는 **DOM 이 현재 나타내는 문서**의
 * 좌표입니다. 재렌더 직후에는 모델 좌표와 같고, 편집 직후에는 다릅니다.
 */

const MARK_TAG: Record<Mark['type'], string> = {
  bold: 'strong',
  italic: 'em',
}

/** 겹치는 마크를 감쌀 순서. 순서가 고정돼야 재렌더가 안정적입니다 */
const MARK_ORDER: Mark['type'][] = ['bold', 'italic']

/** 문단 안의 텍스트 — `<br>` 같은 비텍스트 노드는 세지 않습니다 */
export function paragraphText(el: Element): string {
  let out = ''
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
  while (walker.nextNode()) out += walker.currentNode.nodeValue ?? ''
  return out
}

/** 루트의 문단 요소들 */
export function paragraphs(root: HTMLElement): HTMLElement[] {
  return Array.from(root.children).filter(
    (el): el is HTMLElement => el.tagName === 'P'
  )
}

function renderParagraph(p: Paragraph): HTMLElement {
  const el = document.createElement('p')

  // 빈 문단은 높이가 0 이 되어 커서를 놓을 수 없습니다.
  // `<br>` 은 텍스트로 세지 않으므로 좌표에는 영향이 없습니다.
  if (p.text.length === 0) {
    el.appendChild(document.createElement('br'))
    return el
  }

  const bounds = new Set<number>([0, p.text.length])
  for (const m of p.marks) {
    if (m.from > 0 && m.from < p.text.length) bounds.add(m.from)
    if (m.to > 0 && m.to < p.text.length) bounds.add(m.to)
  }

  const points = [...bounds].sort((a, b) => a - b)

  for (let i = 0; i < points.length - 1; i += 1) {
    const from = points[i]
    const to = points[i + 1]

    const active = MARK_ORDER.filter((type) =>
      p.marks.some((m) => m.type === type && m.from <= from && m.to >= to)
    )

    let node: Node = document.createTextNode(p.text.slice(from, to))
    for (let k = active.length - 1; k >= 0; k -= 1) {
      const wrapper = document.createElement(MARK_TAG[active[k]])
      wrapper.appendChild(node)
      node = wrapper
    }

    el.appendChild(node)
  }

  return el
}

/**
 * 모델로 DOM 을 다시 맞춥니다.
 *
 * **통째로 새로 그립니다.** ProseMirror 는 여기서 DOM 을 비교해 최소한만
 * 고치는데, 그 최적화를 빼면 무슨 일이 벌어지는지가 이 스파이크의 관심사
 * 입니다 — 네이티브 선택이 매번 죽습니다. 그래서 `EditorView` 가 커서를
 * 직접 다시 써 줘야 하고, 그 계산이 `mapPos` 입니다.
 */
export function renderDoc(root: HTMLElement, doc: Doc): void {
  root.replaceChildren(...doc.map(renderParagraph))
}

/** 문단 `index` 의 여는 토큰 자리 (= 그 앞 문단들의 크기 합) */
function paragraphBase(paras: HTMLElement[], index: number): number {
  let base = 0
  for (let i = 0; i < index; i += 1) base += paragraphText(paras[i]).length + 2
  return base
}

/**
 * DOM 좌표 → 문서 위치.
 *
 * 컨테이너가 요소든 텍스트 노드든 `Range.toString()` 으로 길이를 재면
 * 한 줄로 끝납니다. `<br>` 은 문자열에 안 들어가므로 `paragraphText` 와
 * 셈이 정확히 맞습니다.
 */
export function domToPos(
  root: HTMLElement,
  node: Node,
  offset: number
): number | null {
  const paras = paragraphs(root)

  if (node === root) {
    // 문단 사이 — offset 은 자식 인덱스입니다
    const index = Math.min(Math.max(offset, 0), paras.length)
    return paragraphBase(paras, index)
  }

  const index = paras.findIndex((p) => p === node || p.contains(node))
  if (index < 0) return null

  const range = document.createRange()
  range.setStart(paras[index], 0)
  range.setEnd(node, offset)

  return paragraphBase(paras, index) + 1 + range.toString().length
}

/** 문서 위치 → DOM 좌표 */
export function posToDom(
  root: HTMLElement,
  pos: number
): { node: Node; offset: number } | null {
  const paras = paragraphs(root)
  let base = 0

  for (const para of paras) {
    const text = paragraphText(para)
    const inner = pos - base - 1

    if (inner >= 0 && inner <= text.length) {
      let count = 0
      const walker = document.createTreeWalker(para, NodeFilter.SHOW_TEXT)

      while (walker.nextNode()) {
        const length = walker.currentNode.nodeValue?.length ?? 0
        if (count + length >= inner) {
          return { node: walker.currentNode, offset: inner - count }
        }
        count += length
      }

      // 텍스트 노드가 없는 빈 문단
      return { node: para, offset: 0 }
    }

    base += text.length + 2
  }

  return null
}

/** 지금 캐럿이 가리키는 문서 위치. 선택 영역이면 시작점 */
export function readCaret(root: HTMLElement): number | null {
  const selection = root.ownerDocument.getSelection()
  if (!selection || selection.rangeCount === 0) return null

  const range = selection.getRangeAt(0)
  if (!root.contains(range.startContainer)) return null

  return domToPos(root, range.startContainer, range.startOffset)
}

/** 캐럿을 문서 위치로 옮깁니다 — 재렌더로 죽은 선택을 되살리는 자리 */
export function writeCaret(root: HTMLElement, pos: number): boolean {
  const at = posToDom(root, pos)
  if (!at) return false

  const selection = root.ownerDocument.getSelection()
  if (!selection) return false

  const range = document.createRange()
  range.setStart(at.node, at.offset)
  range.collapse(true)

  selection.removeAllRanges()
  selection.addRange(range)

  return true
}
