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
  /**
   * 안 따라가는 드롭다운의 **처음 값**.
   *
   * 이 값이 있으면 "안 따라가는 쪽" 이라는 뜻이고, 고른 값은
   * `state/toolbar-choice` 의 칸에 에디터마다 따로 담깁니다 — 툴바
   * 드롭다운과 더보기 메뉴가 같은 목록을 그리므로, 값을 든 자리가 둘이면
   * 서로 어긋납니다.
   *
   * 따라가는 쪽(글자 크기)에는 없습니다 — 그쪽 값의 출처는 문서입니다.
   */
  initialValue?: string
  /**
   * 따라가는 드롭다운이 현재 값을 읽는 방법.
   *
   * 읽은 값이 목록에 없으면 `unlisted` → `fallbackValue` 순으로 처리합니다.
   */
  query?: (editor: EditorContext) => string | undefined
  /**
   * 목록에 없는 값을 **그대로 보여줍니다** — 읽은 값을 라벨로 바꿔 줍니다.
   *
   * 없으면 `fallbackValue` 로 떨어지는데, 그건 실제와 다른 항목을 가리키는
   * 것이라 크기처럼 값이 연속적인 경우에는 거짓말이 됩니다. 글자 크기가
   * 정확히 그랬습니다 — 15px 짜리 기본 글에 `12` 를 띄우고 있었습니다.
   */
  unlisted?: (value: string) => string
  /** 읽은 값이 목록에 없고 `unlisted` 도 없을 때 가리킬 항목 */
  fallbackValue?: string
  apply: (editor: EditorContext, value: string) => void
}

/**
 * 글자 크기는 **따라가는** 드롭다운입니다 — 캐럿이 있는 글자의 크기를 보여줘야
 * 합니다.
 *
 * ## 라벨이 거짓말을 하고 있었습니다
 *
 * 값이 `execCommand` 의 1~7 스케일이었고, 그 일곱 칸의 실제 크기는
 * 10·13·16·18·24·32·48px 입니다. 라벨은 9·10·11·12·14·18·24·36 이었으니
 * **여덟 중 일곱이 틀렸습니다.**
 *
 * ```
 * 라벨  9 → 값 1 → 10px      라벨 14 → 값 4 → 18px
 * 라벨 10 → 값 1 → 10px  ✓   라벨 18 → 값 5 → 24px
 * 라벨 11 → 값 2 → 13px      라벨 24 → 값 6 → 32px
 * 라벨 12 → 값 3 → 16px      라벨 36 → 값 7 → 48px
 * ```
 *
 * 9 와 10 이 같은 값인 것은 그중 눈에 띄는 증상이었을 뿐입니다.
 *
 * 커맨드 층(`native-font-size`)은 처음부터 `'24px'` 같은 CSS 길이를 받고
 * 있었습니다. 막고 있던 것은 플러그인의 `Number()` 였고, 거기를 열자 **라벨을
 * 그대로 값으로 쓸 수 있게** 됐습니다. 이제 `24` 를 고르면 24px 입니다.
 *
 * ## 목록에 없는 크기
 *
 * 서식 없는 글은 15px 이고 제목은 더 큽니다 — 목록에 없습니다. 예전에는
 * 그런 것도 1~7 중 가까운 칸으로 눌러 답해서, 15px 짜리 기본 글에 커서를
 * 두면 메뉴가 `12` 를 가리켰습니다. **가장 흔한 경우가 가장 크게 틀렸던
 * 셈입니다.**
 *
 * 지금은 `unlisted` 로 실제 크기를 그대로 보여줍니다.
 *
 * ## 전에는 ⌘A 에서 안 따라갔습니다 (지금은 고쳤습니다)
 *
 * Svelte 로 옮기며 사보타주를 돌렸더니 상태 구독을 통째로
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
  options: [9, 10, 11, 12, 14, 18, 24, 36].map((px) => ({
    label: String(px),
    value: `${px}px`,
  })),
  /*
   * `queryValue('fontSize')` 가 아니라 이쪽입니다 — 그쪽은 1~7 스케일로
   * 눌러 답해서 15px 과 16px 을 구분하지 못합니다.
   */
  query: (editor) => editor.commandRegistry?.queryValue('fontSizeCss'),
  unlisted: (css) => String(Math.round(parseFloat(css))),
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
  initialValue: '1.5',
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
  initialValue: '0',
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
  initialValue: 'p',
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
