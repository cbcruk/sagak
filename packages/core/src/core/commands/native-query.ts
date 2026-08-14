import type { CommandRegistry } from '../command-registry'
import { NATIVE_PRECEDENCE } from './native-alignment'
import { INLINE_FORMATS, findFormatAncestor } from './inline-format'
import { closestEditableHost } from './selection-blocks'
import { getPendingFormat } from './stored-marks'
import { cssToLegacyFontSize } from './native-font-size'

/**
 * 범위가 실제로 시작하는 노드를 찾습니다
 *
 * `startContainer` 가 늘 내용은 아닙니다. 범위가 **요소 경계에서** 시작하면
 * 컨테이너는 그 요소 자신이고, 첫 글자는 `childNodes[startOffset]` 안에
 * 있습니다. 전체 선택(⌘A)이 그런 모양입니다 —
 * `selectNodeContents(편집영역)` 이라 `startContainer` 가 편집 영역 `<div>`
 * 입니다.
 *
 * 그걸 그대로 기준으로 삼으면 조상 탐색이 **내용을 건너뛰고** 위로 올라가고,
 * 계산된 스타일도 편집 영역의 기본값을 읽습니다. 재 보면 이렇습니다.
 *
 * ```
 * <p><strong>굵은 글자만</strong></p> 를 ⌘A
 *   queryState('bold')      → false   ← 틀림
 *   queryCommandState('bold') → true
 *
 * <p><font size="5">큰 글자</font></p> 를 ⌘A
 *   queryValue('fontSize')      → "3"  ← 틀림
 *   queryCommandValue('fontSize') → "5"
 * ```
 *
 * 캐럿이나 드래그로 고른 범위는 `startContainer` 가 텍스트 노드라 원래부터
 * 맞았습니다. **경계에서 시작하는 범위만** 틀렸습니다.
 */
function rangeStartNode(range: Range): Node {
  const container = range.startContainer
  if (container.nodeType !== Node.ELEMENT_NODE) return container

  /* 끝에 붙어 접힌 경우 — 내려갈 자식이 없으므로 컨테이너가 기준입니다 */
  let node: Node | null = container.childNodes[range.startOffset] ?? null
  if (!node) return container

  /* 첫 글자가 있는 데까지 내려갑니다 */
  while (node.nodeType === Node.ELEMENT_NODE && node.firstChild) {
    node = node.firstChild
  }
  return node
}

/**
 * 현재 선택의 기준 노드를 가져옵니다
 *
 * 상태·값 조회는 선택 시작 지점의 서식을 기준으로 판단합니다.
 */
function anchorNode(): { node: Node; host: HTMLElement } | null {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) return null

  const range = selection.getRangeAt(0)
  const node = rangeStartNode(range)
  const host = closestEditableHost(node)
  if (!host) return null

  return { node, host }
}

/**
 * 기준 노드에서 가장 가까운 요소를 가져옵니다
 */
function nearestElement(node: Node): HTMLElement | null {
  let current: Node | null = node
  while (current && current.nodeType !== Node.ELEMENT_NODE) {
    current = current.parentNode
  }
  return current instanceof HTMLElement ? current : null
}

/**
 * 상속을 포함해 계산된 CSS 값을 읽습니다
 */
function computedValue(node: Node, prop: 'fontFamily' | 'fontSize'): string {
  const el = nearestElement(node)
  if (!el) return ''
  return window.getComputedStyle(el)[prop] || ''
}

/**
 * 상태·값 조회의 자체 구현을 등록합니다
 *
 * `queryCommandState`/`queryCommandValue` 대신 선택 지점에서 조상 방향으로
 * 서식 요소를 탐색하거나 계산된 스타일을 읽습니다. 네이티브 구현이 생성하는
 * 정규 태그(`strong`/`em` 등)와 별칭 태그(`b`/`i` 등)를 모두 인식합니다.
 *
 * 편집 호스트 밖이거나 선택이 없으면 `undefined`를 반환해 레거시 어댑터에
 * 위임합니다.
 *
 * @param registry 커맨드 레지스트리
 * @returns 모든 등록을 해제하는 함수
 */
export function registerNativeQueries(registry: CommandRegistry): () => void {
  const unsubs: Array<() => void> = []

  for (const [name, format] of Object.entries(INLINE_FORMATS)) {
    unsubs.push(
      registry.registerStateQuery(
        name,
        () => {
          // 보류 서식이 있으면 그것이 현재 상태입니다
          const pendingValue = getPendingFormat(name)
          if (pendingValue !== undefined) return pendingValue

          const found = anchorNode()
          if (!found) return undefined
          return findFormatAncestor(found.node, format, found.host) !== null
        },
        NATIVE_PRECEDENCE
      )
    )
  }

  unsubs.push(
    registry.registerValueQuery(
      'fontName',
      () => {
        const found = anchorNode()
        if (!found) return undefined
        return computedValue(found.node, 'fontFamily')
      },
      NATIVE_PRECEDENCE
    )
  )

  unsubs.push(
    registry.registerValueQuery(
      'fontSize',
      () => {
        const found = anchorNode()
        if (!found) return undefined
        // 레거시 API 호환: 1–7 스케일 문자열을 반환합니다
        return cssToLegacyFontSize(computedValue(found.node, 'fontSize'))
      },
      NATIVE_PRECEDENCE
    )
  )

  return () => {
    for (const unsub of unsubs) unsub()
  }
}
