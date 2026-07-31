import type { CommandRegistry } from '../command-registry'
import { NATIVE_PRECEDENCE } from './native-alignment'
import { applyInlineStyle } from './inline-style'

/**
 * 레거시 `execCommand('fontSize')` 1–7 스케일 → CSS 크기 매핑
 *
 * 브라우저가 `<font size>`에 적용하던 기본 크기를 따릅니다. 이벤트 API는
 * 기존 1–7 스케일을 유지하되, 실제 렌더링은 표준 CSS로 수행합니다.
 */
const LEGACY_SCALE_PX: Record<number, number> = {
  1: 10,
  2: 13,
  3: 16,
  4: 18,
  5: 24,
  6: 32,
  7: 48,
}

/**
 * 1–7 스케일 값을 CSS 크기로 변환합니다
 *
 * @param size 1–7 스케일 값
 * @returns `px` 문자열, 범위 밖이면 `null`
 */
export function legacyFontSizeToCss(size: number): string | null {
  const px = LEGACY_SCALE_PX[size]
  return px === undefined ? null : `${px}px`
}

/**
 * CSS 크기를 1–7 스케일 값으로 되돌립니다 (조회용)
 *
 * 정확히 일치하는 단계가 없으면 가장 가까운 단계를 반환합니다. 레거시
 * `queryCommandValue('fontSize')`가 문자열 숫자를 반환하던 것과 호환됩니다.
 *
 * @param css CSS 크기 (예: `'24px'`)
 * @returns 1–7 스케일 문자열, 판단 불가 시 빈 문자열
 */
export function cssToLegacyFontSize(css: string): string {
  const px = parseFloat(css)
  if (!Number.isFinite(px)) return ''

  let closest = 3
  let smallestDiff = Infinity

  for (const [size, value] of Object.entries(LEGACY_SCALE_PX)) {
    const diff = Math.abs(value - px)
    if (diff < smallestDiff) {
      smallestDiff = diff
      closest = Number(size)
    }
  }

  return String(closest)
}

/**
 * 커맨드 값을 CSS 크기로 해석합니다
 *
 * 1–7 스케일 숫자와 직접 CSS 값(`'20px'`, `'1.5rem'`)을 모두 지원합니다.
 */
function resolveSize(value: string): string | null {
  const numeric = Number(value)

  if (Number.isInteger(numeric) && numeric >= 1 && numeric <= 7) {
    return legacyFontSizeToCss(numeric)
  }

  // 단위가 붙은 CSS 값은 그대로 사용합니다
  return /^-?[\d.]+(px|pt|em|rem|%)$/.test(value.trim()) ? value.trim() : null
}

/**
 * `fontSize` 커맨드의 자체 구현을 등록합니다
 *
 * `execCommand('fontSize')`가 생성하던 `<font size>` 대신 인라인 스타일
 * 엔진으로 `<span style="font-size: ...">`를 적용합니다. 이벤트 API의
 * 1–7 스케일은 그대로 유지되며(하위 호환), CSS 값도 직접 받을 수 있습니다.
 *
 * @param registry 커맨드 레지스트리
 * @returns 등록 해제 함수
 */
export function registerNativeFontSize(registry: CommandRegistry): () => void {
  return registry.register(
    'fontSize',
    (_ctx, value) => {
      if (!value) return undefined

      const css = resolveSize(value)
      if (!css) return undefined

      return applyInlineStyle('fontSize', css)
    },
    NATIVE_PRECEDENCE
  )
}
