import {
  CoreEvents,
  EditingAreaEvents,
  ExportEvents,
  ImageResizeEvents,
} from './events'
import type { EditorErrorData } from './errors'
import type { EditingMode } from './types'

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
  /**
   * 찾기에서 지금 몇 번째가 선택돼 있는가 — **0부터**, 없으면 `-1`.
   *
   * 이게 없던 동안 UI 가 플러그인의 `(index ± 1 + n) % n` 을 똑같이 흉내 내며
   * 같은 상태 기계를 두 벌 돌리고 있었습니다. 인덱스의 주인은 플러그인입니다.
   */
  matchIndex?: number
  replaceCount?: number
  src?: string
  rows?: number
  cols?: number
  rowIndex?: number
  colIndex?: number
  position?: string
}

/** 내보내기 형식 */
export type ExportFormat = 'html' | 'markdown' | 'text'

/** `EXPORT_DOWNLOAD` 페이로드 */
export interface ExportDownloadData {
  format: ExportFormat
  filename?: string
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
  [CoreEvents.STYLE_CHANGED]: StyleChangedPayload
  [CoreEvents.FOCUS_REQUESTED]: void
  [CoreEvents.ERROR]: EditorErrorData

  // --- 텍스트 스타일 (페이로드 없음) ---

  // --- 폰트 ---

  // --- 문단 ---
  /** 객체형과 맨값을 모두 받습니다 (`extractHeadingLevel` 참고) */
  /** 객체형과 맨값을 모두 받습니다 (`extractAlignment` 참고) */

  // --- 콘텐츠 ---
  /** 객체형과 URL 문자열을 모두 받습니다 */

  // --- 히스토리 ---

  // --- 편집 영역 ---
  [EditingAreaEvents.EDITING_AREA_MODE_CHANGED]: {
    from: EditingMode
    to: EditingMode
  }

  // --- WYSIWYG 영역 ---


  // --- 내보내기 ---
  [ExportEvents.EXPORT_DOWNLOAD]: ExportDownloadData

  // --- 이미지 크기 조절 ---
  [ImageResizeEvents.IMAGE_RESIZE_START]: { image: HTMLElement }
  [ImageResizeEvents.IMAGE_RESIZE_END]: void

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

/**
 * 이벤트가 요청인가 통지인가.
 *
 * 버스 하나가 두 가지 일을 겸하고 있는데 이름으로는 구분되지 않습니다.
 * `_CHANGED` 16종을 발행처로 갈라 보면 **7종은 화면이 코어에게 보내는 요청**
 * …)이고 9종만 코어가 화면에게 보내는 통지입니다. 같은 접미사가 정반대 방향에
 * 쓰입니다.
 *
 * 이름을 바꾸면 266곳이 움직이므로 이름은 두고 여기에 새깁니다.
 *
 * ## 왜 "방향" 이 아니라 "요청/통지" 인가
 *
 * 방향(누가 발행하는가)으로 가르면 검증할 수가 없습니다. 자동 완성처럼 코어가
 * 발행하지만 화면이 반드시 처리해야 하는 것들이 어느 쪽도 아니게 됩니다.
 *
 * 요청/통지로 가르면 **반증 가능한 성질**이 생깁니다 —
 *
 * - `request` 는 처리자가 없으면 아무 일도 안 일어납니다. **있어야 합니다.**
 * - `notify` 는 듣는 이가 없어도 유효합니다.
 *
 * 이 성질을 `packages/ui/test/event-contract.browser.test.tsx` 가 앱 전체를
 * 띄운 상태에서 확인합니다. 아무도 처리하지 않는 요청(= 눌러도 아무 일이 없는
 * 버튼)이 그 자리에서 걸립니다. 실제로 처음 돌렸을 때 자동 저장 두 건이
 * 걸렸습니다.
 */
export type EventKind = 'request' | 'notify'

/**
 * 이벤트별 종류.
 *
 * `Record<KnownEventName, …>` 이므로 **하나라도 빠지면 컴파일이 실패합니다.**
 * 이벤트 10종이 맵 밖에 남아 `unknown` 이던 일(`app-or-library.md` §10)과 같은
 * 구멍이 여기서는 생길 수 없습니다.
 */
export const EVENT_KIND: Record<KnownEventName, EventKind> = {
  // --- 코어 ---
  [CoreEvents.APP_READY]: 'notify',
  [CoreEvents.STYLE_CHANGED]: 'notify',
  [CoreEvents.FOCUS_REQUESTED]: 'request',
  [CoreEvents.ERROR]: 'notify',

  // --- 텍스트 스타일 ---

  // --- 폰트 (전부 `_CHANGED` 지만 전부 요청입니다) ---

  // --- 문단 ---

  // --- 콘텐츠 ---

  // --- 히스토리 ---

  // --- 편집 영역 ---
  [EditingAreaEvents.EDITING_AREA_MODE_CHANGED]: 'notify',

  // --- WYSIWYG 영역 (전부 일어난 일의 보고) ---


  // --- 내보내기 ---
  [ExportEvents.EXPORT_DOWNLOAD]: 'request',

  // --- 이미지 크기 조절 ---
  [ImageResizeEvents.IMAGE_RESIZE_START]: 'notify',
  [ImageResizeEvents.IMAGE_RESIZE_END]: 'notify',

}

/** 처리자가 있어야 뜻이 있는 이벤트 */
export type RequestEvent = {
  [K in KnownEventName]: (typeof EVENT_KIND)[K] extends 'request' ? K : never
}[KnownEventName]

/** 듣는 이가 없어도 유효한 이벤트 */
export type NotifyEvent = Exclude<KnownEventName, RequestEvent>
