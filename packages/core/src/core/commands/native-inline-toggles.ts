import type { CommandRegistry } from '../command-registry'
import { NATIVE_PRECEDENCE } from './native-alignment'
import { INLINE_FORMATS, toggleInlineFormat } from './inline-format'
import { togglePendingFormat } from './stored-marks'

/**
 * 인라인 토글 커맨드(bold/italic/underline/strikeThrough/subscript/
 * superscript)의 자체 구현을 등록합니다
 *
 * `execCommand` 대신 `inline-format` 엔진으로 선택 범위를 정규 태그
 * (`strong`, `em`, `u`, `s`, `sub`, `sup`)로 감싸거나 해제합니다.
 *
 * collapsed 커서에서는 보류 서식 상태(stored marks)에 기록합니다 — 커서에서
 * 굵게를 켜고 입력하면 굵게로 입력되는 UX를 에디터가 직접 구현합니다.
 *
 * 선택/편집 호스트/텍스트 노드가 없는 경우에만 레거시 어댑터에 위임합니다.
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
      registry.register(
        name,
        () => {
          const result = toggleInlineFormat(name)
          if (result !== undefined) return result

          // collapsed 커서 → 보류 서식으로 기록
          return togglePendingFormat(name) ? true : undefined
        },
        NATIVE_PRECEDENCE
      )
    )
  }

  return () => {
    for (const unsub of unsubs) unsub()
  }
}
