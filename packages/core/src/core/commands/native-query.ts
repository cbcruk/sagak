import type { CommandRegistry } from '../command-registry'
import { NATIVE_PRECEDENCE } from './native-alignment'
import { INLINE_FORMATS, findFormatAncestor } from './inline-format'
import { closestEditableHost } from './selection-blocks'
import { getPendingFormat } from './stored-marks'
import { cssToLegacyFontSize } from './native-font-size'

/**
 * 현재 선택의 기준 노드를 가져옵니다
 *
 * 상태·값 조회는 선택 시작 지점의 서식을 기준으로 판단합니다.
 */
function anchorNode(): { node: Node; host: HTMLElement } | null {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) return null

  const range = selection.getRangeAt(0)
  const node = range.startContainer
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
