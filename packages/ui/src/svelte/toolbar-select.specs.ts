import { FontEvents, ParagraphEvents } from 'sagak-core'
import type { EditorContext } from 'sagak-core'

/**
 * 툴바 드롭다운 넷의 **알맹이** — 항목 목록과 "고르면 무엇을 쏘는가" 입니다.
 *
 * ## 팩토리가 데이터가 됐습니다
 *
 * 커스텀 엘리먼트 시절에는 `defineToolbarSelect(태그, 명세)` 로 넷을 찍어
 * 냈습니다. 태그마다 클래스를 하나씩 등록해야 했기 때문입니다. Svelte 에서는
 * 컴포넌트 하나에 props 를 넘기면 되므로 **팩토리가 필요 없고**, 남는 것은
 * 이 명세들뿐입니다.
 *
 * ## 목록 값은 옮겨 적으면 안 됩니다
 *
 * 여기서 한 번 틀렸습니다 — 자간 목록을 소스에서 안 읽고 그럴듯한 숫자로
 * 적었더니(`0/0.5/1/1.5/2`), 실제(`Normal/0.05/…/0.3`)와 달라 **가장 긴
 * 항목이 바뀌면서 셀렉트 폭이 85 → 63px** 이 됐습니다. 툴바가 `flex-wrap`
 * 이라 줄바꿈 위치까지 흔들렸고 폭 검사가 그걸 잡았습니다.
 */

export interface ToolbarSelectOption {
  label: string
  value: string
}

export interface ToolbarSelectSpec {
  title: string
  options: ToolbarSelectOption[]
  /** 안 따라가는 드롭다운의 처음 값 */
  defaultValue?: string
  /**
   * 따라가는 드롭다운이 현재 값을 읽는 방법.
   *
   * 목록에 없는 값이 나오면 `fallbackValue` 로 떨어집니다.
   */
  query?: (editor: EditorContext) => string | undefined
  /** 읽은 값이 목록에 없을 때 가리킬 항목 */
  fallbackValue?: string
  apply: (editor: EditorContext, value: string) => void
}

/**
 * 글자 크기는 **따라가는** 드롭다운입니다 — 캐럿이 있는 글자의 크기를 보여줘야
 * 합니다. 값은 `execCommand` 의 1~7 스케일이라 라벨(9·10·11…)과 다릅니다.
 *
 * 9 와 10 이 둘 다 `'1'` 인 것은 Preact 판 그대로입니다. 스케일에 그 사이가
 * 없어서인데, 그래서 9 를 골라도 메뉴는 10 을 가리킵니다. 옮기면서 고치지
 * 않았습니다 — 이주는 동작을 같게 두는 것이 먼저입니다.
 *
 * ## 다만 지금은 **안 따라갑니다** (이주와 무관한 문제)
 *
 * Svelte 로 옮기며 사보타주를 돌렸더니 `subscribeToSelection` 구독을 통째로
 * 지워도 검사가 하나도 안 걸렸습니다. 재 보니 구독이 안 도는 것이 아니라
 * **질의가 늘 같은 값을 돌려줍니다.**
 *
 * ```
 * <p><font size="5">큰 글자</font></p> 를 전부 선택한 상태
 *   commandRegistry.queryValue('fontSize') → "3"   ← 이 값을 씁니다
 *   document.queryCommandValue('fontSize') → "5"   ← 실제
 * ```
 *
 * `??` 는 `null`·`undefined` 일 때만 넘어가는데 레지스트리가 `"3"` 을 주므로
 * 네이티브 값까지 못 갑니다. 그래서 글자 크기 메뉴는 무엇을 골라 두든 늘
 * `12` 를 가리킵니다.
 *
 * **이주가 만든 것이 아닙니다** — nanotags 판으로 되돌려 같은 것을 재 봤고
 * 값이 똑같았습니다. 고칠 자리는 `sagak-core` 의 `commandRegistry` 라 여기가
 * 아닙니다. `query`/`fallbackValue` 갈래를 쓰는 것이 이 하나뿐이므로, 그
 * 갈래는 지금 **사실상 죽어 있습니다.**
 */
export const FONT_SIZE: ToolbarSelectSpec = {
  title: 'Font Size',
  options: [
    { label: '9', value: '1' },
    { label: '10', value: '1' },
    { label: '11', value: '2' },
    { label: '12', value: '3' },
    { label: '14', value: '4' },
    { label: '18', value: '5' },
    { label: '24', value: '6' },
    { label: '36', value: '7' },
  ],
  fallbackValue: '3',
  query: (editor) =>
    editor.commandRegistry?.queryValue('fontSize') ??
    document.queryCommandValue('fontSize'),
  apply: (editor, fontSize) => {
    editor.eventBus.emit(FontEvents.FONT_SIZE_CHANGED, { fontSize })
  },
}

export const LINE_HEIGHT: ToolbarSelectSpec = {
  title: 'Line Height',
  options: [
    { label: '1.0', value: '1' },
    { label: '1.15', value: '1.15' },
    { label: '1.5', value: '1.5' },
    { label: '2.0', value: '2' },
    { label: '2.5', value: '2.5' },
    { label: '3.0', value: '3' },
  ],
  defaultValue: '1.5',
  apply: (editor, lineHeight) => {
    editor.eventBus.emit(FontEvents.LINE_HEIGHT_CHANGED, { lineHeight })
  },
}

export const LETTER_SPACING: ToolbarSelectSpec = {
  title: 'Letter Spacing',
  options: [
    { label: 'Normal', value: '0' },
    { label: '0.05', value: '0.05' },
    { label: '0.1', value: '0.1' },
    { label: '0.15', value: '0.15' },
    { label: '0.2', value: '0.2' },
    { label: '0.3', value: '0.3' },
  ],
  defaultValue: '0',
  apply: (editor, letterSpacing) => {
    editor.eventBus.emit(FontEvents.LETTER_SPACING_CHANGED, { letterSpacing })
  },
}

/**
 * 문단 스타일만 **고른 값에 따라 다른 이벤트**를 씁니다 — 문단(`p`)은 제목
 * 해제라 `FORMAT_PARAGRAPH`, 나머지는 `HEADING_CHANGED` 에 레벨을 실어 보냅니다.
 */
export const HEADING: ToolbarSelectSpec = {
  title: 'Paragraph Style',
  options: [
    { label: '¶', value: 'p' },
    { label: 'Heading 1', value: '1' },
    { label: 'Heading 2', value: '2' },
    { label: 'Heading 3', value: '3' },
    { label: 'Heading 4', value: '4' },
    { label: 'Heading 5', value: '5' },
    { label: 'Heading 6', value: '6' },
  ],
  defaultValue: 'p',
  apply: (editor, value) => {
    if (value === 'p') {
      editor.eventBus.emit(ParagraphEvents.FORMAT_PARAGRAPH)
      return
    }
    editor.eventBus.emit(ParagraphEvents.HEADING_CHANGED, {
      level: parseInt(value, 10),
    })
  },
}
