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
 * ## 전에는 ⌘A 에서 안 따라갔습니다 (지금은 고쳤습니다)
 *
 * Svelte 로 옮기며 사보타주를 돌렸더니 `subscribeToSelection` 구독을 통째로
 * 지워도 검사가 하나도 안 걸렸습니다. 구독이 안 도는 것이 아니라 **질의가
 * 틀린 값을 주고 있었습니다.**
 *
 * ```
 * <p><font size="5">큰 글자</font></p>
 *   캐럿·드래그로 고르면  → "5"  (맞음)
 *   ⌘A 로 전부 고르면     → "3"  (틀림, 네이티브는 "5")
 * ```
 *
 * 원인은 `sagak-core` 의 `native-query` 였습니다 — 조회가 `startContainer`
 * 를 기준으로 하는데 `selectNodeContents(편집영역)` 은 그것이 편집 영역
 * `<div>` 라, 조상 탐색이 내용을 건너뛰고 위로 올라갔습니다. 굵게 같은 서식
 * 상태도 같이 틀렸습니다.
 *
 * 거기서 고쳤고, 검사는 코어(경계에서 시작하는 범위 다섯)와 툴바(⌘A 에서
 * 굵게·크기가 보이는지 둘) 양쪽에 있습니다.
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
