/**
 * `EditorCore`가 발행하는 코어 이벤트
 */
export const CoreEvents = {
  /**
   * 애플리케이션 준비 완료 - 모든 플러그인 초기화 후 발행
   */
  APP_READY: 'APP_READY',

  /**
   * 서식 상태 변경 - 텍스트 서식이 변경될 때 발행
   */

  /**
   * 스타일 변경 - 모든 서식 작업 후 발행
   */
  STYLE_CHANGED: 'STYLE_CHANGED',

  /**
   * 콘텐츠가 `undo`/`redo`를 통해 복원됨
   */

  /**
   * 히스토리 스냅샷 캡처 요청
   * 스타일 적용 등 즉시 스냅샷이 필요할 때 발행
   */

  /**
   * 편집 영역으로 포커스 복귀 요청
   *
   * 툴바 버튼을 누르면 포커스가 그 버튼으로 옮겨갑니다. 커맨드는 저장된
   * 선택 영역으로 동작하므로 편집 자체는 되지만, 이어서 타이핑하면 키 입력이
   * 편집 영역에 닿지 않고 사라집니다. 커맨드가 성공한 뒤 이 이벤트로
   * 포커스를 되돌립니다.
   */
  FOCUS_REQUESTED: 'FOCUS_REQUESTED',

  /**
   * 에디터 오류 발생 - 플러그인/코어에서 오류가 포착될 때 발행
   * 페이로드: `EditorErrorData`
   */
  ERROR: 'EDITOR_ERROR',
} as const

/*
 * **서식 이벤트가 통째로 없어졌습니다.**
 *
 * 굵게·글꼴·정렬·목록·표·이미지·링크 32종이 여기 있었습니다. 전부 커맨드가
 * 됐고, 툴바는 이제 커맨드 레지스트리를 직접 부릅니다
 * (`docs/prosemirror-migration.md` §11).
 *
 * 남은 이벤트는 **커맨드가 아닌 것들**입니다 — 되돌리기·찾기·자동 저장·
 * 자동 완성처럼 상태나 흐름을 다루는 일, 그리고 밖에서 붙을 확장점.
 */

/**
 * 찾기/바꾸기 플러그인 이벤트 (기본값)
 */
export const FindReplaceEvents = {
  FIND: 'FIND',
  FIND_NEXT: 'FIND_NEXT',
  FIND_PREVIOUS: 'FIND_PREVIOUS',
  REPLACE: 'REPLACE',
  REPLACE_ALL: 'REPLACE_ALL',
  CLEAR_FIND: 'CLEAR_FIND',
} as const

/**
 * 자동완성 플러그인 이벤트
 */
export const AutocompleteEvents = {
  /** 자동완성 제안 표시 */
  AUTOCOMPLETE_SHOW: 'AUTOCOMPLETE_SHOW',
  /** 자동완성 제안 숨기기 */
  AUTOCOMPLETE_HIDE: 'AUTOCOMPLETE_HIDE',
  /** 자동완성 제안 선택 */
  AUTOCOMPLETE_SELECT: 'AUTOCOMPLETE_SELECT',
  /** 자동완성 제안 적용 */
  AUTOCOMPLETE_APPLY: 'AUTOCOMPLETE_APPLY',
} as const

/**
 * `EditingAreaManager` 이벤트
 */
export const EditingAreaEvents = {
  EDITING_AREA_MODE_CHANGED: 'EDITING_AREA_MODE_CHANGED',
} as const

/**
 * `WysiwygArea` 이벤트
 */
export const WysiwygEvents = {
  WYSIWYG_AREA_SHOWN: 'WYSIWYG_AREA_SHOWN',
  WYSIWYG_AREA_HIDDEN: 'WYSIWYG_AREA_HIDDEN',
  WYSIWYG_CONTENT_CHANGED: 'WYSIWYG_CONTENT_CHANGED',
  WYSIWYG_FOCUSED: 'WYSIWYG_FOCUSED',
  WYSIWYG_BLURRED: 'WYSIWYG_BLURRED',
  WYSIWYG_PASTE: 'WYSIWYG_PASTE',
  WYSIWYG_KEYDOWN: 'WYSIWYG_KEYDOWN',
  WYSIWYG_KEYUP: 'WYSIWYG_KEYUP',
} as const

/**
 * 자동 저장 플러그인 이벤트
 */
export const AutoSaveEvents = {
  AUTO_SAVE_STATUS_CHANGED: 'AUTO_SAVE_STATUS_CHANGED',
  AUTO_SAVE_RESTORE: 'AUTO_SAVE_RESTORE',
  AUTO_SAVE_CLEAR: 'AUTO_SAVE_CLEAR',
} as const

/**
 * 내보내기 플러그인 이벤트
 */
export const ExportEvents = {
  EXPORT_DOWNLOAD: 'EXPORT_DOWNLOAD',
} as const

/**
 * 이미지 크기 조절 플러그인 이벤트
 */
export const ImageResizeEvents = {
  IMAGE_RESIZE_START: 'IMAGE_RESIZE_START',
  IMAGE_RESIZE_END: 'IMAGE_RESIZE_END',
} as const

/**
 * 이미지 업로드 플러그인 이벤트
 */
export const ImageUploadEvents = {
  IMAGE_UPLOAD_START: 'IMAGE_UPLOAD_START',
  IMAGE_UPLOAD_COMPLETE: 'IMAGE_UPLOAD_COMPLETE',
  IMAGE_UPLOAD_ERROR: 'IMAGE_UPLOAD_ERROR',
  IMAGE_UPLOAD_FROM_FILE: 'IMAGE_UPLOAD_FROM_FILE',
} as const

/**
 * 모든 이벤트 이름 결합
 */
export const EditorEvents = {
  ...CoreEvents,
  ...FindReplaceEvents,
  ...AutocompleteEvents,
  ...EditingAreaEvents,
  ...WysiwygEvents,
  ...AutoSaveEvents,
  ...ExportEvents,
  ...ImageResizeEvents,
  ...ImageUploadEvents,
} as const

/**
 * 모든 이벤트 이름의 타입
 */
export type EditorEventName = (typeof EditorEvents)[keyof typeof EditorEvents]

/**
 * 코어 이벤트 이름의 타입
 */
export type CoreEventName = (typeof CoreEvents)[keyof typeof CoreEvents]

/**
 * 플러그인 이벤트 이름의 타입
 */
export type PluginEventName = Exclude<EditorEventName, CoreEventName>
