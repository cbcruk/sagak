import type { CommandRegistry } from '../command-registry'
import { NATIVE_PRECEDENCE } from './native-alignment'
import { toggleList, shiftIndent } from './list-format'

/**
 * 리스트·들여쓰기 커맨드의 자체 구현을 등록합니다
 *
 * `execCommand('insertOrderedList'|'insertUnorderedList'|'indent'|'outdent')`
 * 대신 리스트 트리를 직접 조작합니다.
 *
 * - 리스트 토글: 블록 → `<li>` 변환/해제, 종류 변경(ol ↔ ul), 인접 리스트 병합
 * - 들여쓰기: 리스트 항목은 중첩 리스트로, 일반 블록은 `margin-left`로 처리
 *
 * 다음 경우에는 레거시 어댑터에 위임합니다:
 * - 선택/편집 호스트/블록 없음
 * - 리스트 항목과 일반 블록이 섞인 선택 (구조 판단이 모호)
 * - 변환 불가 블록(표 등)이나 중첩 블록을 담은 요소 포함
 * - 들여쓰기 대상이 하나도 없는 경우 (예: 리스트 첫 항목 단독 들여쓰기)
 *
 * @param registry 커맨드 레지스트리
 * @returns 모든 등록을 해제하는 함수
 */
export function registerNativeList(registry: CommandRegistry): () => void {
  const unsubs: Array<() => void> = [
    registry.register(
      'insertOrderedList',
      () => toggleList('ol'),
      NATIVE_PRECEDENCE
    ),
    registry.register(
      'insertUnorderedList',
      () => toggleList('ul'),
      NATIVE_PRECEDENCE
    ),
    registry.register('indent', () => shiftIndent(1), NATIVE_PRECEDENCE),
    registry.register('outdent', () => shiftIndent(-1), NATIVE_PRECEDENCE),
  ]

  return () => {
    for (const unsub of unsubs) unsub()
  }
}
