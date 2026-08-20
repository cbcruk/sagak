/**
 * `EditorCore`가 발행하는 코어 이벤트
 */
export const CoreEvents = {
  /**
   * 커맨드가 하나 돌았습니다 — `{ style, value }`
   *
   * **지금 듣는 곳이 없습니다.** 마지막 청취자는 자동 저장이었는데, 두
   * 리사이즈가 DOM 에만 쓰던 시절에 저장을 깨우는 용도였습니다. 둘이 모델로
   * 가면서 트랜잭션 하나로 충분해졌습니다 (§12-5).
   */
  STYLE_CHANGED: 'STYLE_CHANGED',

  /**
   * 에디터 오류 발생 - 플러그인/코어에서 오류가 포착될 때 발행
   * 페이로드: `EditorErrorData`
   */
  ERROR: 'EDITOR_ERROR',
} as const

/*
 * **`APP_READY` 와 `FOCUS_REQUESTED` 가 여기 있었습니다.**
 *
 * 둘 다 제품 코드에서는 한쪽 끝이 비어 있었습니다 —
 *
 * - `APP_READY` 는 발행만 하고 **아무도 안 들었습니다.** `run()` 을 기다리거나
 *   `onready` 를 받으면 되는 일이라 애초에 두 벌이었습니다.
 * - `FOCUS_REQUESTED` 는 처리자만 있고 **아무도 안 발행했습니다.** 포커스
 *   되돌리기는 `runCommand` 가 `area.focus()` 로 직접 합니다.
 *
 * 둘 다 자기 검사에만 나왔습니다 — 배선을 검사하는 검사입니다.
 */

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
/*
 * 자동 저장 셋도 여기 없습니다 — `autoSave(context)` 입니다
 * (`features/auto-save.ts`). 상태 알림은 `subscribe`, 지우기는 메서드가 됐고,
 * `AUTO_SAVE_RESTORE` 는 **아무도 안 부르던 요청**이었습니다.
 */

/**
 * 내보내기 플러그인 이벤트
 */
export const ExportEvents = {
  EXPORT_DOWNLOAD: 'EXPORT_DOWNLOAD',
} as const

/*
 * 이미지 조절 둘도 여기 없습니다. 아무도 안 들었고, 짝이 되는 콜백조차
 * 없었습니다 — 확장점으로 열어 둔 것이 아니라 **아무 데도 안 닿은 배선**
 * 이었습니다. 조절이 실제로 남기는 것은 이제 문서의 `width`·`height` 입니다.
 */

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
  ...ExportEvents,
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
