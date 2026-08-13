/**
 * 폰트 메뉴의 상수 — Preact 판과 커스텀 엘리먼트 판이 **같은 것**을 봅니다.
 *
 * 이주 중에는 두 구현이 공존합니다. 값을 양쪽에 따로 적어 두면 한쪽만 고쳐도
 * 테스트가 통과해 버립니다 — 이 파일에서 이미 한 번 겪었습니다(센티널 값이
 * 소스와 테스트 양쪽에서 같은 방식으로 깨져 있어 서로 맞아떨어졌습니다).
 */

export const FALLBACK_FONTS = [
  {
    label: 'Sans',
    value:
      '"Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", "Nanum Gothic", sans-serif',
  },
  {
    label: 'Serif',
    value: '"AppleMyungjo", "Batang", "Noto Serif KR", "Nanum Myeongjo", serif',
  },
  {
    label: 'Mono',
    value: '"D2Coding", "Nanum Gothic Coding", ui-monospace, monospace',
  },
]

export const LOAD_SYSTEM_FONTS_VALUE = '__sagak_load_system_fonts__'

export const SYSTEM_GROUP = 'Korean'
export const FALLBACK_GROUP = 'Default'

export const FIXED_WIDTH = 104
