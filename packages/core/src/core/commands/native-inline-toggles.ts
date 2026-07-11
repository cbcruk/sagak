import type { CommandRegistry } from '../command-registry'
import { NATIVE_PRECEDENCE } from './native-alignment'
import { INLINE_FORMATS, toggleInlineFormat } from './inline-format'

/**
 * 인라인 토글 커맨드(bold/italic/underline/strikeThrough/subscript/
 * superscript)의 자체 구현을 등록합니다
 *
 * `execCommand` 대신 `inline-format` 엔진으로 선택 범위를 정규 태그
 * (`strong`, `em`, `u`, `s`, `sub`, `sup`)로 감싸거나 해제합니다.
 *
 * 다음 경우에는 레거시 어댑터에 위임합니다:
 * - collapsed 커서 토글 — execCommand의 내부 "타이핑 상태"가 필요
 *   (커서 위치에서 굵게를 켜고 입력하면 굵게로 입력되는 UX)
 * - 선택/편집 호스트/텍스트 노드 없음
 *
 * 상태 조회(`queryCommandState`)는 이 단계에서 교체하지 않습니다 —
 * 타이핑 상태를 포함한 조회는 레거시가 정확하며, 네이티브가 생성하는
 * 태그(`strong` 등)에 대해서도 올바르게 동작합니다.
 *
 * @param registry 커맨드 레지스트리
 * @returns 모든 등록을 해제하는 함수
 */
export function registerNativeInlineToggles(
  registry: CommandRegistry
): () => void {
  const unsubs: Array<() => void> = []

  for (const name of Object.keys(INLINE_FORMATS)) {
    unsubs.push(
      registry.register(name, () => toggleInlineFormat(name), NATIVE_PRECEDENCE)
    )
  }

  return () => {
    for (const unsub of unsubs) unsub()
  }
}
