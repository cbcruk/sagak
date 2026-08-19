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
  CAPTURE_SNAPSHOT: 'CAPTURE_SNAPSHOT',

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

/**
 * 텍스트 스타일 플러그인 이벤트 (기본값)
 */
export const TextStyleEvents = {
  BOLD_CLICKED: 'BOLD_CLICKED',
  ITALIC_CLICKED: 'ITALIC_CLICKED',
  UNDERLINE_CLICKED: 'UNDERLINE_CLICKED',
  STRIKE_CLICKED: 'STRIKE_CLICKED',
  TOGGLE_SUBSCRIPT: 'TOGGLE_SUBSCRIPT',
  TOGGLE_SUPERSCRIPT: 'TOGGLE_SUPERSCRIPT',
} as const

/**
 * 폰트 플러그인 이벤트 (기본값)
 */
export const FontEvents = {
  FONT_FAMILY_CHANGED: 'FONT_FAMILY_CHANGED',
  FONT_SIZE_CHANGED: 'FONT_SIZE_CHANGED',
  TEXT_COLOR_CHANGED: 'TEXT_COLOR_CHANGED',
  BACKGROUND_COLOR_CHANGED: 'BACKGROUND_COLOR_CHANGED',
  LINE_HEIGHT_CHANGED: 'LINE_HEIGHT_CHANGED',
  LETTER_SPACING_CHANGED: 'LETTER_SPACING_CHANGED',
} as const

/**
 * 문단 플러그인 이벤트 (기본값)
 */
export const ParagraphEvents = {
  HEADING_CHANGED: 'HEADING_CHANGED',
  FORMAT_PARAGRAPH: 'FORMAT_PARAGRAPH',
  ALIGNMENT_CHANGED: 'ALIGNMENT_CHANGED',
  INDENT_CLICKED: 'INDENT_CLICKED',
  OUTDENT_CLICKED: 'OUTDENT_CLICKED',
  ORDERED_LIST_CLICKED: 'ORDERED_LIST_CLICKED',
  UNORDERED_LIST_CLICKED: 'UNORDERED_LIST_CLICKED',
} as const

/**
 * 콘텐츠 플러그인 이벤트 (기본값)
 */
export const ContentEvents = {
  LINK_CHANGED: 'LINK_CHANGED',
  LINK_REMOVED: 'LINK_REMOVED',

  IMAGE_INSERT: 'IMAGE_INSERT',
  IMAGE_UPDATE: 'IMAGE_UPDATE',
  IMAGE_DELETE: 'IMAGE_DELETE',

  TABLE_CREATE: 'TABLE_CREATE',
  TABLE_INSERT_ROW: 'TABLE_INSERT_ROW',
  TABLE_DELETE_ROW: 'TABLE_DELETE_ROW',
  TABLE_INSERT_COLUMN: 'TABLE_INSERT_COLUMN',
  TABLE_DELETE_COLUMN: 'TABLE_DELETE_COLUMN',
  TABLE_DELETE: 'TABLE_DELETE',

  HORIZONTAL_RULE_INSERT: 'HORIZONTAL_RULE_INSERT',
  SPECIAL_CHARACTER_INSERT: 'SPECIAL_CHARACTER_INSERT',
} as const

/**
 * 히스토리 플러그인 이벤트 (기본값)
 */
export const HistoryEvents = {
  UNDO: 'UNDO',
  REDO: 'REDO',
} as const

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
  ...TextStyleEvents,
  ...FontEvents,
  ...ParagraphEvents,
  ...ContentEvents,
  ...HistoryEvents,
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
