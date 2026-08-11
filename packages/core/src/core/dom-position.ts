/**
 * DOM 좌표를 **정수 위치**로 바꿉니다.
 *
 * ## 왜 필요한가
 *
 * `Range` 는 **노드 참조**입니다. `innerHTML` 을 갈아끼우면 그 노드들이
 * 떨어져 나가고, 되살리려 해도 조용히 문서 맨 앞으로 갑니다 (예외도 안
 * 납니다). undo 가 정확히 그 일을 하고 있습니다.
 *
 * 정수 위치는 노드를 안 붙듭니다. 내용이 갈아끼워져도 "이 문서의 11번째
 * 자리" 는 여전히 말이 되고, 같은 HTML 을 되돌려 놓으면 같은 자리를 가리
 * 킵니다.
 *
 * ## 좌표계
 *
 * `spike/doc-model` 과 같은 방식이고, 거기서는 문단 배열 위였던 것을 여기서는
 * **DOM 트리 위**로 옮겼습니다. 위치는 글자가 아니라 **틈**이고, 요소의
 * 여닫는 지점도 위치를 하나씩 먹습니다.
 *
 * ```
 * <div>  <p>  a  b  </p>  <p>  c  </p>  </div>      ← div 가 root
 *        0    1  2  3     4    5  6
 *
 * 0  첫 문단 밖 (문서 시작)
 * 1  첫 문단 안, a 앞
 * 3  b 뒤, 첫 문단 안의 끝
 * 4  문단 사이
 * ```
 *
 * root 자신의 여닫는 지점은 세지 않습니다. 유효한 위치는 `0 … size(root)`
 * 입니다.
 *
 * ## 모델이 필요 없습니다
 *
 * 이 파일은 **DOM 만 봅니다.** 문서 모델도, 스키마도 참조하지 않습니다.
 * `docs/spike-to-product.md` 의 결론이 그것입니다 — 본체에 필요한 것은
 * 모델이 아니라 좌표입니다.
 */

/**
 * 안이 없는 요소 — 위치를 하나만 먹습니다.
 *
 * `<br>` 이나 `<img>` 안에는 캐럿을 놓을 수 없으므로 여는/닫는 지점을 따로
 * 셀 이유가 없습니다. 글자 하나처럼 다룹니다.
 */
const LEAF_TAGS = new Set([
  'BR',
  'IMG',
  'HR',
  'INPUT',
  'AREA',
  'COL',
  'EMBED',
  'SOURCE',
  'TRACK',
  'WBR',
])

function isLeaf(node: Node): boolean {
  return node.nodeType === Node.ELEMENT_NODE && LEAF_TAGS.has(node.nodeName)
}

/**
 * 노드 하나가 차지하는 위치 수.
 *
 * - 텍스트 → 글자 수
 * - 안이 없는 요소 → 1
 * - 그 밖의 요소 → 여는 토큰 + 자식들 + 닫는 토큰
 *
 * 주석·처리 명령 등은 0 으로 셉니다. 캐럿이 갈 수 없는 자리이고, 0 으로
 * 두면 좌표에서 아예 없는 것처럼 다뤄집니다.
 */
export function nodeSize(node: Node): number {
  if (node.nodeType === Node.TEXT_NODE) return node.nodeValue?.length ?? 0
  if (node.nodeType !== Node.ELEMENT_NODE) return 0
  if (isLeaf(node)) return 1

  let size = 0
  for (let child = node.firstChild; child; child = child.nextSibling) {
    size += nodeSize(child)
  }
  return size + 2
}

/** root 안의 유효한 위치 범위는 `0 … contentSize(root)` 입니다 */
export function contentSize(root: Node): number {
  let size = 0
  for (let child = root.firstChild; child; child = child.nextSibling) {
    size += nodeSize(child)
  }
  return size
}

/** 노드의 **여는 지점** 위치 — root 기준. root 밖이면 `null` */
function positionBefore(root: Node, node: Node): number | null {
  let pos = 0
  let current = node

  while (current !== root) {
    const parent = current.parentNode
    if (!parent) return null

    for (
      let sib = parent.firstChild;
      sib && sib !== current;
      sib = sib.nextSibling
    ) {
      pos += nodeSize(sib)
    }

    // 부모 안으로 한 칸 들어오면서 여는 토큰을 지납니다 (root 는 안 셉니다)
    if (parent !== root) pos += 1

    current = parent
  }

  return pos
}

/**
 * DOM 좌표 → 정수 위치.
 *
 * @param node `Range` 의 `startContainer` 같은 것
 * @param offset 텍스트 노드면 글자 오프셋, 요소면 자식 인덱스
 */
export function domToPos(
  root: HTMLElement,
  node: Node,
  offset: number
): number | null {
  if (node !== root && !root.contains(node)) return null

  const before = positionBefore(root, node)
  if (before === null) return null

  if (node.nodeType === Node.TEXT_NODE) {
    const length = node.nodeValue?.length ?? 0
    return before + Math.min(Math.max(offset, 0), length)
  }

  // 요소 안의 자식 인덱스 — root 는 여는 토큰이 없습니다
  let pos = before + (node === root ? 0 : 1)
  let index = 0
  for (
    let child = node.firstChild;
    child && index < offset;
    child = child.nextSibling, index += 1
  ) {
    pos += nodeSize(child)
  }

  return pos
}

export interface DomPoint {
  node: Node
  offset: number
}

/**
 * 정수 위치 → DOM 좌표.
 *
 * 같은 위치를 가리키는 DOM 좌표가 여럿일 때(예: 텍스트 노드의 끝 = 다음
 * 형제 앞)는 **텍스트 노드 쪽을 고릅니다.** 캐럿을 놓는 것이 목적이고,
 * 요소 경계에 놓인 캐럿은 브라우저마다 다르게 굴기 때문입니다.
 */
export function posToDom(root: HTMLElement, pos: number): DomPoint | null {
  if (pos < 0 || pos > contentSize(root)) return null

  let node: Node = root
  let base = 0 // node 의 내용이 시작하는 위치

  for (;;) {
    const target = pos - base
    let acc = 0
    let index = 0
    let lastText: DomPoint | null = null
    let descend: Node | null = null

    for (let child = node.firstChild; child; child = child.nextSibling) {
      const size = nodeSize(child)

      if (child.nodeType === Node.TEXT_NODE) {
        if (target >= acc && target <= acc + size) {
          return { node: child, offset: target - acc }
        }
      } else if (!isLeaf(child) && target > acc && target < acc + size) {
        descend = child
        base = base + acc + 1
        break
      }

      if (target === acc) {
        return lastText ?? { node, offset: index }
      }

      acc += size
      index += 1
      lastText = null
    }

    if (descend) {
      node = descend
      continue
    }

    if (target === acc) return { node, offset: index }
    return null
  }
}

export interface PositionRange {
  anchor: number
  head: number
}

/** 지금 선택 영역을 정수 위치 쌍으로. root 밖이면 `null` */
export function readSelectionPositions(
  root: HTMLElement
): PositionRange | null {
  const selection = root.ownerDocument.getSelection()
  if (!selection || selection.rangeCount === 0) return null
  if (!selection.anchorNode || !selection.focusNode) return null
  if (!root.contains(selection.anchorNode)) return null

  const anchor = domToPos(root, selection.anchorNode, selection.anchorOffset)
  const head = domToPos(root, selection.focusNode, selection.focusOffset)
  if (anchor === null || head === null) return null

  return { anchor, head }
}

/**
 * 정수 위치 쌍으로 선택 영역을 되돌립니다.
 *
 * 문서가 줄어들어 위치가 범위를 벗어나면 **끝으로 접습니다.** 되돌릴 자리가
 * 아예 없는 것보다 낫고, `spike/doc-model` 의 `mapPos` 가 지워진 구간을
 * 경계로 접는 것과 같은 처리입니다.
 */
export function writeSelectionPositions(
  root: HTMLElement,
  range: PositionRange
): boolean {
  const max = contentSize(root)
  const anchor = posToDom(root, Math.min(Math.max(range.anchor, 0), max))
  const head = posToDom(root, Math.min(Math.max(range.head, 0), max))
  if (!anchor || !head) return false

  const selection = root.ownerDocument.getSelection()
  if (!selection) return false

  const domRange = root.ownerDocument.createRange()
  domRange.setStart(anchor.node, anchor.offset)
  domRange.collapse(true)

  selection.removeAllRanges()
  selection.addRange(domRange)

  if (range.head !== range.anchor) {
    selection.extend(head.node, head.offset)
  }

  return true
}
