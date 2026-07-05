import DOMPurify, { type Config } from 'dompurify'

/**
 * HTML 문자열을 안전한 HTML로 정화하는 함수
 */
export type Sanitizer = (html: string) => string

/**
 * 정화기 옵션
 */
export interface SanitizerOptions {
  /**
   * `DOMPurify` 설정 재정의
   *
   * 에디터가 생성하는 서식 태그(굵게, 표, 이미지, 링크 등)는 기본 프로필에서
   * 허용됩니다. 추가 태그/속성을 허용하거나 제한하려면 이 값을 사용하세요.
   */
  config?: Config
}

/**
 * 에디터 콘텐츠에 대한 정화기의 기본 설정
 *
 * `<script>`, 인라인 이벤트 핸들러(`onclick` 등), `javascript:` URI를 제거하고
 * 서식/표/링크/이미지에 필요한 태그와 인라인 스타일은 유지합니다.
 */
const DEFAULT_CONFIG: Config = {
  // 에디터 콘텐츠는 항상 HTML 문자열로 다뤄지므로 문자열을 반환하도록 강제합니다
  RETURN_DOM: false,
  RETURN_DOM_FRAGMENT: false,
  // 링크가 새 탭에서 안전하게 열리도록 rel 보강을 허용합니다
  ADD_ATTR: ['target'],
}

/**
 * `DOMPurify` 기반 정화기를 생성합니다
 *
 * @param options - 정화기 옵션
 * @returns HTML 문자열을 정화하는 함수
 *
 * @example
 * ```typescript
 * const sanitize = createSanitizer()
 * sanitize('<img src=x onerror=alert(1)>') // => '<img src="x">'
 * ```
 */
export function createSanitizer(options: SanitizerOptions = {}): Sanitizer {
  const config: Config = { ...DEFAULT_CONFIG, ...options.config }

  return (html: string): string => {
    return DOMPurify.sanitize(html, config) as string
  }
}

/**
 * 정화를 수행하지 않고 입력을 그대로 반환하는 정화기
 *
 * 신뢰할 수 있는 콘텐츠만 다루는 고급 사용 사례에서 정화를 비활성화할 때
 * 사용합니다 (`sanitize: false`).
 */
export const identitySanitizer: Sanitizer = (html: string): string => html

/**
 * 에디터 설정에서 전달되는 정화 옵션
 *
 * - `true` 또는 미지정: 기본 정화기 사용 (권장)
 * - `false`: 정화 비활성화 (신뢰할 수 있는 콘텐츠 전용)
 * - `SanitizerOptions`: 사용자 정의 `DOMPurify` 설정
 */
export type SanitizeOption = boolean | SanitizerOptions

/**
 * `SanitizeOption`을 정화기 함수로 변환합니다
 *
 * @param option - 에디터 설정의 정화 옵션 (기본값: 정화 활성화)
 * @returns 정화기 함수
 */
export function resolveSanitizer(option?: SanitizeOption): Sanitizer {
  if (option === false) {
    return identitySanitizer
  }

  if (option && typeof option === 'object') {
    return createSanitizer(option)
  }

  return createSanitizer()
}
