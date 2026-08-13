import { FontEvents, ParagraphEvents } from 'sagak-core'
import { defineToolbarSelect } from './toolbar-select'

/**
 * 툴바 드롭다운 넷 — 1단계에서 옮긴 것들.
 *
 * 항목 목록과 "고르면 무엇을 쏘는가"만 다릅니다. 나머지(선택 영역 저장/복원,
 * 상태 추적)는 `defineToolbarSelect` 가 합니다.
 *
 * 목록 값은 **Preact 판에서 그대로 가져와야 합니다.** 여기서 한 번 틀렸습니다 —
 * 자간 목록을 소스에서 안 읽고 그럴듯한 숫자로 적었더니(`0/0.5/1/1.5/2`),
 * 실제(`Normal/0.05/…/0.3`)와 달라 **가장 긴 항목이 바뀌면서 셀렉트 폭이
 * 85 → 63px** 이 됐습니다. 툴바가 `flex-wrap` 이라 줄바꿈 위치까지 흔들렸고,
 * 폭 검사가 그걸 잡았습니다.
 *
 * 옮기는 일에서 "값을 다시 적는" 자리는 전부 이 위험을 갖습니다.
 */

export const FONT_SIZE_SELECT_TAG = 'sagak-font-size-select'
export const LINE_HEIGHT_SELECT_TAG = 'sagak-line-height-select'
export const LETTER_SPACING_SELECT_TAG = 'sagak-letter-spacing-select'
export const HEADING_SELECT_TAG = 'sagak-heading-select'

/**
 * 글자 크기는 **따라가는** 드롭다운입니다 — 캐럿이 있는 글자의 크기를 보여줘야
 * 합니다. 값은 `execCommand` 의 1~7 스케일이라 라벨(9·10·11…)과 다릅니다.
 *
 * 9 와 10 이 둘 다 `'1'` 인 것은 Preact 판 그대로입니다. 스케일에 그 사이가
 * 없어서인데, 그래서 9 를 골라도 메뉴는 10 을 가리킵니다. 옮기면서 고치지
 * 않았습니다 — 이주는 동작을 같게 두는 것이 먼저입니다.
 */
defineToolbarSelect(FONT_SIZE_SELECT_TAG, {
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
})

defineToolbarSelect(LINE_HEIGHT_SELECT_TAG, {
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
})

defineToolbarSelect(LETTER_SPACING_SELECT_TAG, {
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
})

/**
 * 문단 스타일만 **고른 값에 따라 다른 이벤트**를 씁니다 — 문단(`p`)은 제목
 * 해제라 `FORMAT_PARAGRAPH`, 나머지는 `HEADING_CHANGED` 에 레벨을 실어 보냅니다.
 */
defineToolbarSelect(HEADING_SELECT_TAG, {
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
})
