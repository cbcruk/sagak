/**
 * "훅" 이라는 이름만 남았습니다.
 *
 * Preact 를 걷어내면서 실제 훅은 전부 사라졌고, 여기 있는 것은 **렌더러와
 * 무관한 구독과 저장소**입니다 — 선택 영역 추적과 폰트 목록. 이름은
 * 그대로 두었습니다. 부르는 곳이 열 군데가 넘고, 이름을 바꾸는 것과 이
 * 이주가 섞이면 어느 쪽이 무엇을 깨뜨렸는지 알기 어려워집니다.
 */

export { subscribeToSelection } from './use-selection-derived'

export {
  $families,
  $status,
  loadLocalFonts,
  watchLocalFontPermission,
} from './use-local-fonts'
export type { LocalFontsStatus, UseLocalFontsReturn } from './use-local-fonts'
