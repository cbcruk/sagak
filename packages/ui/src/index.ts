/**
 * `sagak-ui` 의 공개 얼굴입니다.
 *
 * 앱은 이제 `sagak-ui/svelte/…` 로 컴포넌트를 하나씩 집으므로 여기서
 * 내보낼 컴포넌트가 없습니다. 남은 것은 **컴포넌트가 아닌 것들**입니다 —
 * 문서 저장소와 선택 영역 구독.
 */

export {
  UNTITLED,
  attachDocument,
  create,
  open,
  readDocument,
  readNow,
  refresh,
  remove,
  rename,
  save,
  saveAs,
  subscribeToDocument,
} from './state/document-store'
export type { DocumentSnapshot } from './state/document-store'

export { subscribeToSelection } from './state/selection'
