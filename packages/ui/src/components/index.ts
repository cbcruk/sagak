/**
 * 밖으로 내놓는 Preact 컴포넌트들 — **다섯만 남았습니다.**
 *
 * 예전에는 툴바 안의 조각까지 스물 몇 개를 내놓고 있었습니다. 그것들을 커스텀
 * 엘리먼트와 Svelte 로 옮기면서 Preact 판이 아무도 안 쓰는 채로 남아 있었고,
 * 이번에 지웠습니다.
 *
 * 남은 다섯은 **앱이 조립하는 단위**입니다 — 편집 영역, 그것을 감싸는 상자,
 * 툴바, 문서 줄, 그리고 편집 영역 위에 뜨는 자동 완성 팝오버. 툴바 안의 버튼
 * 하나하나를 밖에서 골라 쓰는 쓰임은 없었고(앱은 `<Toolbar />` 만 씁니다),
 * 지금은 그 안이 대부분 Svelte 라 내놓을 것도 아닙니다.
 *
 * `Toolbar` 와 `DocumentBar` 는 Svelte 를 감싼 껍데기입니다. 앱까지 Svelte 가
 * 되면 이 파일도 사라집니다.
 */

export { EditingArea } from './editing-area/editing-area'
export type { EditingAreaProps } from './editing-area/editing-area'

export { EditorContainer } from './editor-container/editor-container'
export type { EditorContainerProps } from './editor-container/editor-container'

export { Toolbar } from './toolbar/toolbar'

/*
 * 자동 완성 팝오버는 툴바가 아니라 **앱이 직접** 붙입니다 — 편집 영역 위에
 * 떠야 하기 때문입니다. 아직 Preact 판뿐이라 남습니다.
 */
export { AutocompletePopover } from './autocomplete-popover/autocomplete-popover'

export { DocumentBar } from './document-bar/document-bar'
export type { DocumentBarProps } from './document-bar/document-bar'
