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

/*
 * 찾기/바꾸기 여섯은 여기 없습니다 — `findReplace(context)` 의 메서드입니다
 * (`features/find-replace.ts`). 한 객체의 메서드를 이름 문자열로 부르는 데는
 * 이유가 없었고, 결과(일치 개수·현재 번호)를 서식 알림에 얹어 되쏘던 것도
 * 함께 없어졌습니다.
 */

/*
 * 자동 완성 넷도 여기 없습니다 — `autocomplete(context)` 입니다
 * (`features/autocomplete.ts`). 특히 `AUTOCOMPLETE_APPLY` 는 **한 이름이 양쪽
 * 방향으로** 쓰이고 있었습니다: 코어가 빈 채로 쏘면 팝오버가 고른 단어를 실어
 * 같은 이름으로 되쏘았습니다. 고른 번호의 주인을 코어로 옮기니 왕복이 없어
 * 집니다.
 */

/**
 * `EditingAreaManager` 이벤트
 */
export const EditingAreaEvents = {
  EDITING_AREA_MODE_CHANGED: 'EDITING_AREA_MODE_CHANGED',
} as const

/**
 * `WysiwygArea` 이벤트
 */
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

/*
 * 이미지 업로드 넷도 여기 없습니다 — `imageUpload(context)` 입니다
 * (`features/image-upload.ts`). 알림 셋은 **아무도 안 들었고** 같은 것을
 * 알리는 콜백이 이미 옵션에 있었습니다. 요청 하나는 **아무도 안 불렀는데**
 * 그 뒤의 검사·변환은 멀쩡했고, UI 가 그것을 똑같이 다시 짜서 쓰고 있었습니다.
 */

/**
 * 모든 이벤트 이름 결합
 */
export const EditorEvents = {
  ...CoreEvents,
  ...EditingAreaEvents,
  ...AutoSaveEvents,
  ...ExportEvents,
  ...ImageResizeEvents,
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
