import type { CommandRegistry } from '../command-registry'
import { selectedBlocks } from './selection-blocks'
import { NATIVE_PRECEDENCE } from './native-alignment'

/**
 * `formatBlock`으로 변환 가능한 대상 태그
 *
 * 리스트 항목(`li`) 등 구조적 요소는 제외합니다 — 변환 시 리스트 구조가
 * 깨지므로 해당 케이스는 레거시 어댑터에 위임합니다.
 */
const FORMAT_TAGS = new Set([
  'p',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'div',
  'blockquote',
  'pre',
])

/**
 * `formatBlock` 값(`'<h2>'`, `'h2'`, `'H2'` 등)에서 태그 이름을 추출합니다
 *
 * @returns 소문자 태그 이름, 지원하지 않는 값이면 `null`
 */
function parseTag(value: string | undefined): string | null {
  if (!value) return null

  const tag = value.replace(/[<>]/g, '').trim().toLowerCase()
  return FORMAT_TAGS.has(tag) ? tag : null
}

/**
 * 블록 요소를 다른 태그로 교체합니다 (자식·속성 보존)
 */
function replaceTag(block: HTMLElement, tag: string): HTMLElement {
  const replacement = document.createElement(tag)

  for (const attr of Array.from(block.attributes)) {
    replacement.setAttribute(attr.name, attr.value)
  }

  while (block.firstChild) {
    replacement.appendChild(block.firstChild)
  }

  block.replaceWith(replacement)
  return replacement
}

/**
 * `formatBlock` 커맨드의 자체 구현을 등록합니다
 *
 * `execCommand('formatBlock')` 대신 선택 범위와 교차하는 최내곽 블록 요소를
 * 목표 태그(`p`, `h1`~`h6` 등)로 직접 교체합니다. 자식 노드와 속성을 보존하며,
 * 텍스트 노드가 이동 후에도 동일 객체로 유지되므로 선택 영역을 복원합니다.
 *
 * 다음 경우에는 `undefined`를 반환해 레거시 어댑터로 위임합니다:
 * - 지원하지 않는 값 (알 수 없는 태그)
 * - 선택 영역/편집 호스트/교차 블록 없음
 * - 교차 블록 중 변환 불가 요소(`li` 등)가 포함된 경우 (부분 적용 방지)
 *
 * @param registry 커맨드 레지스트리
 * @returns 등록 해제 함수
 */
export function registerNativeFormatBlock(
  registry: CommandRegistry
): () => void {
  return registry.register(
    'formatBlock',
    (_ctx, value) => {
      const tag = parseTag(value)
      if (!tag) {
        return undefined
      }

      const found = selectedBlocks()
      if (!found) {
        return undefined
      }

      // 변환 불가 블록이 섞여 있으면 부분 적용 대신 전체를 레거시에 위임합니다
      for (const block of found.blocks) {
        if (!FORMAT_TAGS.has(block.tagName.toLowerCase())) {
          return undefined
        }
      }

      // 선택 경계를 보존합니다 — 자식 노드는 이동 후에도 동일 객체이므로
      // 교체된 블록 자체가 경계인 경우만 매핑하면 됩니다
      const { range } = found
      const saved = {
        startContainer: range.startContainer,
        startOffset: range.startOffset,
        endContainer: range.endContainer,
        endOffset: range.endOffset,
      }

      const replacements = new Map<Node, HTMLElement>()

      for (const block of found.blocks) {
        if (block.tagName.toLowerCase() === tag) continue
        replacements.set(block, replaceTag(block, tag))
      }

      if (replacements.size > 0) {
        const mapNode = (node: Node): Node => replacements.get(node) ?? node

        const selection = window.getSelection()
        if (selection) {
          const restored = document.createRange()
          restored.setStart(mapNode(saved.startContainer), saved.startOffset)
          restored.setEnd(mapNode(saved.endContainer), saved.endOffset)
          selection.removeAllRanges()
          selection.addRange(restored)
        }
      }

      return true
    },
    NATIVE_PRECEDENCE
  )
}
