import { logger } from '@/core/logger'
import type { CompositionTracker } from './composition'

/**
 * IME 조합 중이라 동작을 차단해야 하는지 판단합니다
 *
 * 한글·일본어·중국어 입력은 `compositionstart`와 `compositionend` 사이에서 문자를
 * 조립합니다. 그 사이에 서식 명령이 실행되면 조합 중인 문자가 끊기거나 선택 영역이
 * 어긋나므로, 조합이 끝날 때까지 명령을 막습니다.
 *
 * @param composition 조합 상태를 보는 창구
 * @param checkComposition 가드 활성화 여부 (플러그인 옵션)
 * @param label 로그에 표시할 이름 (예: `'Bold'`)
 * @returns 차단해야 하면 `true` (이 경우 경고 로그를 남깁니다)
 *
 * @example
 * ```typescript
 * if (isBlockedByComposition(composition, checkComposition, 'Link')) {
 *   return false
 * }
 * ```
 */
export function isBlockedByComposition(
  composition: CompositionTracker | undefined,
  checkComposition: boolean | undefined,
  label: string
): boolean {
  if (checkComposition && composition?.isComposing()) {
    logger.warn(`${label} blocked: IME composition in progress`)
    return true
  }

  return false
}
