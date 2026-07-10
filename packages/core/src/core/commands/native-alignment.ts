import type { CommandRegistry } from '../command-registry'

/**
 * 정렬 커맨드 → `text-align` 값 매핑
 */
const ALIGNMENT_VALUES: Record<string, string> = {
  justifyLeft: 'left',
  justifyCenter: 'center',
  justifyRight: 'right',
  justifyFull: 'justify',
}

/**
 * 정렬 대상이 되는 블록 요소 셀렉터
 */
const BLOCK_SELECTOR = 'p, h1, h2, h3, h4, h5, h6, li, blockquote, pre, div'

/**
 * 자체 구현 커맨드의 precedence
 *
 * 레거시 `execCommand` 어댑터(-100)보다 높아 우선 실행되고,
 * 소비자가 더 높은 precedence로 오버라이드할 여지를 남깁니다.
 */
export const NATIVE_PRECEDENCE = 0

/**
 * 노드가 속한 최상위 편집 가능 호스트를 찾습니다
 */
function closestEditableHost(node: Node | null): HTMLElement | null {
  let current: Node | null = node

  while (current) {
    if (current instanceof HTMLElement && current.isContentEditable) {
      let host = current
      while (host.parentElement?.isContentEditable) {
        host = host.parentElement
      }
      return host
    }
    current = current.parentNode
  }

  return null
}

/**
 * 현재 선택 범위와 교차하는 최내곽 블록 요소들을 찾습니다
 *
 * @returns 블록 배열, 또는 판단 불가 시 `null`
 *          (선택 없음 / 편집 호스트 없음 / 교차 블록 없음)
 */
function selectedBlocks(): HTMLElement[] | null {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) return null

  const range = selection.getRangeAt(0)
  const host = closestEditableHost(range.commonAncestorContainer)
  if (!host) return null

  const blocks: HTMLElement[] = []

  for (const el of host.querySelectorAll<HTMLElement>(BLOCK_SELECTOR)) {
    if (!range.intersectsNode(el)) continue

    // 교차하는 자식 블록이 있으면 최내곽이 아니므로 건너뜁니다
    let hasIntersectingChildBlock = false
    for (const child of el.querySelectorAll<HTMLElement>(BLOCK_SELECTOR)) {
      if (range.intersectsNode(child)) {
        hasIntersectingChildBlock = true
        break
      }
    }

    if (!hasIntersectingChildBlock) {
      blocks.push(el)
    }
  }

  return blocks.length > 0 ? blocks : null
}

/**
 * 정렬 커맨드의 자체 구현을 등록합니다
 *
 * `execCommand('justify*')` 대신 선택 범위와 교차하는 최내곽 블록 요소들의
 * `text-align` 스타일을 직접 설정합니다. 브라우저별 마크업 편차 없이 항상
 * 인라인 스타일 하나로 표현됩니다.
 *
 * 선택 영역이 없거나 편집 호스트/블록을 찾지 못하는 경우에는 `undefined`를
 * 반환해 낮은 precedence의 레거시 어댑터로 위임합니다.
 *
 * @param registry 커맨드 레지스트리
 * @returns 모든 등록을 해제하는 함수
 */
export function registerNativeAlignment(registry: CommandRegistry): () => void {
  const unsubs: Array<() => void> = []

  for (const [command, value] of Object.entries(ALIGNMENT_VALUES)) {
    unsubs.push(
      registry.register(
        command,
        () => {
          const blocks = selectedBlocks()
          if (!blocks) {
            // 판단 불가 → 레거시 execCommand로 위임
            return undefined
          }

          for (const block of blocks) {
            block.style.textAlign = value
          }

          return true
        },
        NATIVE_PRECEDENCE
      )
    )
  }

  return () => {
    for (const unsub of unsubs) unsub()
  }
}
