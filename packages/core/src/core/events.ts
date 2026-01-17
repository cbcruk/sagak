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
  FORMATTING_STATE_CHANGED: 'FORMATTING_STATE_CHANGED',

  /**
   * 스타일 변경 - 모든 서식 작업 후 발행
   */
  STYLE_CHANGED: 'STYLE_CHANGED',

  /**
   * 콘텐츠가 `undo`/`redo`를 통해 복원됨
   */
  CONTENT_RESTORED: 'CONTENT_RESTORED',

  /**
   * 히스토리 스냅샷 캡처 요청
   * 스타일 적용 등 즉시 스냅샷이 필요할 때 발행
   */
  CAPTURE_SNAPSHOT: 'CAPTURE_SNAPSHOT',
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
} as const

/**
 * 히스토리 플러그인 이벤트 (기본값)
 */
export const HistoryEvents = {
  UNDO: 'UNDO',
  REDO: 'REDO',
  HISTORY_STATE_CHANGED: 'HISTORY_STATE_CHANGED',
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
 * `EditingAreaManager` 이벤트
 */
export const EditingAreaEvents = {
  EDITING_AREA_INITIALIZED: 'EDITING_AREA_INITIALIZED',
  EDITING_AREA_MODE_CHANGING: 'EDITING_AREA_MODE_CHANGING',
  EDITING_AREA_MODE_CHANGED: 'EDITING_AREA_MODE_CHANGED',
  EDITING_AREA_DESTROYED: 'EDITING_AREA_DESTROYED',
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
  WYSIWYG_SELECTION_CHANGED: 'WYSIWYG_SELECTION_CHANGED',
  WYSIWYG_PASTE: 'WYSIWYG_PASTE',
  WYSIWYG_KEYDOWN: 'WYSIWYG_KEYDOWN',
  WYSIWYG_KEYUP: 'WYSIWYG_KEYUP',
  WYSIWYG_RESIZED: 'WYSIWYG_RESIZED',
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
  ...EditingAreaEvents,
  ...WysiwygEvents,
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
