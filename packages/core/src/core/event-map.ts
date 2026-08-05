import {
  CoreEvents,
  TextStyleEvents,
  FontEvents,
  ParagraphEvents,
  ContentEvents,
  HistoryEvents,
  FindReplaceEvents,
  AutocompleteEvents,
  EditingAreaEvents,
  WysiwygEvents,
  AutoSaveEvents,
  ExportEvents,
  ImageResizeEvents,
  ImageUploadEvents,
} from './events'
import type { EditorErrorData } from './errors'
import type { EditingMode } from './types'

/**
 * 서식 상태 (툴바 활성 표시용)
 */
export interface FormattingStatePayload {
  isBold: boolean
  isItalic: boolean
  isUnderline: boolean
  isStrikeThrough: boolean
  isSubscript: boolean
  isSuperscript: boolean
}

/**
 * 서식이 적용된 뒤 발행되는 알림
 *
 * `style`은 무엇이 바뀌었는지를 나타내고, 나머지는 발행처에 따라 달라집니다.
 * 구독자 대부분은 "무언가 바뀌었다"는 신호로만 쓰므로 세부 필드는 선택입니다.
 */
export interface StyleChangedPayload {
  style: string
  value?: unknown
  action?: string
  matchCount?: number
  replaceCount?: number
  src?: string
  rows?: number
  cols?: number
  rowIndex?: number
  colIndex?: number
  position?: string
}

export interface FindPayload {
  query: string
  caseSensitive?: boolean
  wholeWord?: boolean
}

export interface ReplacePayload {
  query: string
  replacement: string
  caseSensitive?: boolean
  wholeWord?: boolean
}

/**
 * 이미지 페이로드 (`ImageData`와 동일한 형태)
 *
 * 삽입은 `src`가 필수, 갱신은 전부 선택입니다.
 */
export interface ImagePayload {
  src: string
  width?: string
  height?: string
  alt?: string
  alignment?: string
  border?: string
}

/**
 * 표 생성 페이로드 — 모든 필드가 선택이며 미지정 시 플러그인 기본값을 씁니다
 *
 * `cols`의 별칭으로 `columns`도 받습니다 (`extractTableCreateData` 참고).
 */
export interface TableCreatePayload {
  rows?: number
  cols?: number
  columns?: number
  border?: string
  width?: string
}

/** 자동 저장 상태 */
export type AutoSaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error'

/** `AUTO_SAVE_STATUS_CHANGED` 페이로드 */
export interface AutoSaveEventData {
  status: AutoSaveStatus
  timestamp?: number
  error?: Error
}

/** 내보내기 형식 */
export type ExportFormat = 'html' | 'markdown' | 'text'

/** `EXPORT_DOWNLOAD` 페이로드 */
export interface ExportDownloadData {
  format: ExportFormat
  filename?: string
}

export interface AutocompleteShowPayload {
  suggestions: string[]
  prefix: string
  position: { x: number; y: number }
}

/**
 * 이벤트 이름 → 페이로드 타입
 *
 * `EventBus.emit`과 `EventBus.on`이 이 맵을 참조해 페이로드를 검사합니다.
 * 페이로드가 없는 이벤트는 `void`입니다.
 *
 * 여기에 없는 이벤트 이름도 발행할 수 있습니다(플러그인이 `eventName` 옵션으로
 * 커스텀 이름을 쓸 수 있으므로). 그 경우 페이로드는 `unknown`으로 다뤄집니다.
 */
export interface EditorEventMap {
  // --- 코어 ---
  [CoreEvents.APP_READY]: void
  [CoreEvents.FORMATTING_STATE_CHANGED]: FormattingStatePayload
  [CoreEvents.STYLE_CHANGED]: StyleChangedPayload
  [CoreEvents.CONTENT_RESTORED]: { action: 'undo' | 'redo' } | void
  [CoreEvents.CAPTURE_SNAPSHOT]: void
  [CoreEvents.FOCUS_REQUESTED]: void
  [CoreEvents.ERROR]: EditorErrorData

  // --- 텍스트 스타일 (페이로드 없음) ---
  [TextStyleEvents.BOLD_CLICKED]: void
  [TextStyleEvents.ITALIC_CLICKED]: void
  [TextStyleEvents.UNDERLINE_CLICKED]: void
  [TextStyleEvents.STRIKE_CLICKED]: void
  [TextStyleEvents.TOGGLE_SUBSCRIPT]: void
  [TextStyleEvents.TOGGLE_SUPERSCRIPT]: void

  // --- 폰트 ---
  [FontEvents.FONT_FAMILY_CHANGED]: { fontFamily: string }
  [FontEvents.FONT_SIZE_CHANGED]: { fontSize: string | number }
  [FontEvents.TEXT_COLOR_CHANGED]: { color: string }
  [FontEvents.BACKGROUND_COLOR_CHANGED]: { color: string }
  [FontEvents.LINE_HEIGHT_CHANGED]: { lineHeight: string | number }
  [FontEvents.LETTER_SPACING_CHANGED]: { letterSpacing: string | number }

  // --- 문단 ---
  /** 객체형과 맨값을 모두 받습니다 (`extractHeadingLevel` 참고) */
  [ParagraphEvents.HEADING_CHANGED]: { level: number } | number
  [ParagraphEvents.FORMAT_PARAGRAPH]: void
  /** 객체형과 맨값을 모두 받습니다 (`extractAlignment` 참고) */
  [ParagraphEvents.ALIGNMENT_CHANGED]: { align: string } | string
  [ParagraphEvents.INDENT_CLICKED]: void
  [ParagraphEvents.OUTDENT_CLICKED]: void
  [ParagraphEvents.ORDERED_LIST_CLICKED]: void
  [ParagraphEvents.UNORDERED_LIST_CLICKED]: void

  // --- 콘텐츠 ---
  /** 객체형과 URL 문자열을 모두 받습니다 */
  [ContentEvents.LINK_CHANGED]: { url: string; target?: string } | string
  [ContentEvents.LINK_REMOVED]: void
  [ContentEvents.IMAGE_INSERT]: ImagePayload
  [ContentEvents.IMAGE_UPDATE]: Partial<ImagePayload>
  [ContentEvents.IMAGE_DELETE]: void
  [ContentEvents.TABLE_CREATE]: TableCreatePayload | void
  [ContentEvents.TABLE_INSERT_ROW]: { position?: string } | void
  [ContentEvents.TABLE_DELETE_ROW]: void
  [ContentEvents.TABLE_INSERT_COLUMN]: { position?: string } | void
  [ContentEvents.TABLE_DELETE_COLUMN]: void
  [ContentEvents.TABLE_DELETE]: void
  [ContentEvents.HORIZONTAL_RULE_INSERT]: void
  [ContentEvents.SPECIAL_CHARACTER_INSERT]: { character: string }

  // --- 히스토리 ---
  [HistoryEvents.UNDO]: void
  [HistoryEvents.REDO]: void
  [HistoryEvents.HISTORY_STATE_CHANGED]: { canUndo: boolean; canRedo: boolean }

  // --- 찾기/바꾸기 ---
  [FindReplaceEvents.FIND]: FindPayload
  [FindReplaceEvents.FIND_NEXT]: void
  [FindReplaceEvents.FIND_PREVIOUS]: void
  [FindReplaceEvents.REPLACE]: ReplacePayload
  [FindReplaceEvents.REPLACE_ALL]: ReplacePayload
  [FindReplaceEvents.CLEAR_FIND]: void

  // --- 자동완성 ---
  [AutocompleteEvents.AUTOCOMPLETE_SHOW]: AutocompleteShowPayload
  [AutocompleteEvents.AUTOCOMPLETE_HIDE]: void
  [AutocompleteEvents.AUTOCOMPLETE_SELECT]: { direction: 'next' | 'prev' }
  /**
   * 페이로드 없이 발행하면 "현재 선택된 항목을 적용"을 뜻하고,
   * 팝오버가 이를 받아 `{ word }`를 담아 다시 발행합니다.
   */
  [AutocompleteEvents.AUTOCOMPLETE_APPLY]: { word: string } | void

  // --- 편집 영역 ---
  [EditingAreaEvents.EDITING_AREA_INITIALIZED]: { mode: EditingMode }
  [EditingAreaEvents.EDITING_AREA_MODE_CHANGING]: {
    from: EditingMode
    to: EditingMode
  }
  [EditingAreaEvents.EDITING_AREA_MODE_CHANGED]: {
    from: EditingMode
    to: EditingMode
  }
  [EditingAreaEvents.EDITING_AREA_DESTROYED]: void

  // --- WYSIWYG 영역 ---
  [WysiwygEvents.WYSIWYG_AREA_SHOWN]: void
  [WysiwygEvents.WYSIWYG_AREA_HIDDEN]: void
  [WysiwygEvents.WYSIWYG_CONTENT_CHANGED]: { content: string }
  [WysiwygEvents.WYSIWYG_FOCUSED]: void
  [WysiwygEvents.WYSIWYG_BLURRED]: void
  [WysiwygEvents.WYSIWYG_SELECTION_CHANGED]: void
  [WysiwygEvents.WYSIWYG_PASTE]: { event: ClipboardEvent }
  [WysiwygEvents.WYSIWYG_KEYDOWN]: { event: KeyboardEvent }
  [WysiwygEvents.WYSIWYG_KEYUP]: { event: KeyboardEvent }
  [WysiwygEvents.WYSIWYG_RESIZED]: { width: number; height: number }

  // --- 자동 저장 ---
  [AutoSaveEvents.AUTO_SAVE_STATUS_CHANGED]: AutoSaveEventData
  [AutoSaveEvents.AUTO_SAVE_RESTORE]: void
  [AutoSaveEvents.AUTO_SAVE_CLEAR]: void

  // --- 내보내기 ---
  [ExportEvents.EXPORT_DOWNLOAD]: ExportDownloadData

  // --- 이미지 크기 조절 ---
  [ImageResizeEvents.IMAGE_RESIZE_START]: { image: HTMLElement }
  [ImageResizeEvents.IMAGE_RESIZE_END]: void

  // --- 이미지 업로드 ---
  [ImageUploadEvents.IMAGE_UPLOAD_START]: { file: File }
  [ImageUploadEvents.IMAGE_UPLOAD_COMPLETE]: { url: string }
  [ImageUploadEvents.IMAGE_UPLOAD_ERROR]: { error: Error }
  [ImageUploadEvents.IMAGE_UPLOAD_FROM_FILE]: { file: File }
}

/**
 * 페이로드 타입이 등록된 이벤트 이름
 */
export type KnownEventName = keyof EditorEventMap

/**
 * 이벤트 이름으로 페이로드 타입을 조회합니다
 *
 * 맵에 없는 이름(플러그인 커스텀 이벤트 등)은 `unknown`이 됩니다.
 */
export type PayloadOf<E extends string> = E extends KnownEventName
  ? EditorEventMap[E]
  : unknown
