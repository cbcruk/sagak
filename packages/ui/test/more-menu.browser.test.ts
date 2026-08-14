import { describe, it, expect, afterEach } from 'vitest'
import {
  mountEditor,
  placeCaretInText,
  selectAll,
  settle,
  click,
  type MountedEditor,
} from './harness'

/**
 * 더보기 메뉴의 **특성 테스트** — 옮기기 전에 지금 동작을 못 박습니다.
 * (색 고르개와 같은 이유: 검사가 없으면 이주의 관문이 눈이 멉니다.)
 *
 * ## 읽다가 나온 것 — 열 개 중 일곱이 아무것도 안 합니다
 *
 * 메뉴 항목의 절반 이상이 **빈 함수**입니다.
 *
 * | 항목 | 동작 |
 * | --- | --- |
 * | 수평선 · 아래첨자 · 위첨자 | 이벤트를 쏩니다 |
 * | 링크 · 이미지 · 표 · 특수문자 · 찾기 · 줄 간격 · 자간 | **아무것도 안 합니다** |
 *
 * 소스에 `// Link dialog will be triggered separately` 처럼 적혀 있습니다 —
 * 나중에 잇겠다고 두고 안 이은 자리입니다. 좁은 화면에서는 이 메뉴가 그
 * 기능들에 닿는 **유일한 길**인데(툴바에서 `mobile-hidden` 으로 감춰집니다),
 * 눌러도 아무 일이 없습니다.
 *
 * **여기서는 고치지 않습니다.** 이주는 동작을 같게 두는 것이 먼저이고, 죽은
 * 버튼 일곱을 살리는 것은 별개의 일입니다. 다만 **죽은 것을 검사로 못 박지도
 * 않습니다** — 아래는 실제로 동작하는 셋과 열고 닫기만 봅니다. 나중에 이으면
 * 이 테스트는 그대로 두고 새 검사를 더하면 됩니다.
 */

let ed: MountedEditor | null = null

afterEach(() => {
  ed?.unmount()
  ed = null
})

const trigger = (): HTMLElement =>
  ed!.root.querySelector('[data-scope="more-menu"][data-part="trigger"]') as HTMLElement

const menu = (): HTMLElement | null =>
  ed!.root.querySelector('[data-scope="more-menu"][data-part="menu"]')

function item(label: string): HTMLElement {
  const found = [
    ...ed!.root.querySelectorAll<HTMLElement>(
      '[data-scope="more-menu"][data-part="item"]'
    ),
  ].find((el) => el.textContent?.includes(label))
  expect(found, `"${label}" 항목을 찾지 못했습니다`).toBeDefined()
  return found as HTMLElement
}

describe('더보기 메뉴', () => {
  it('누르면 열리고 다시 누르면 닫힙니다', async () => {
    ed = await mountEditor('<p>hello</p>')
    await settle()

    expect(menu(), '처음부터 열려 있습니다').toBeNull()

    await click(trigger())
    expect(menu(), '눌렀는데 안 열립니다').not.toBeNull()

    await click(trigger())
    expect(menu(), '다시 눌렀는데 안 닫힙니다').toBeNull()
  })

  it('바깥을 누르면 닫힙니다', async () => {
    ed = await mountEditor('<p>hello</p>')
    await settle()

    await click(trigger())
    expect(menu()).not.toBeNull()

    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    await settle()

    expect(menu(), '바깥을 눌렀는데 안 닫힙니다').toBeNull()
  })

  it('묶음 제목과 항목이 다 있습니다', async () => {
    ed = await mountEditor('<p>hello</p>')
    await settle()
    await click(trigger())

    const titles = [
      ...ed.root.querySelectorAll('[data-part="section-title"]'),
    ].map((el) => el.textContent)
    expect(titles).toEqual(['Insert', 'Text Style', 'Format', 'Tools'])

    const items = ed.root.querySelectorAll('[data-part="item"]')
    expect(items.length, '항목 수가 달라졌습니다').toBe(10)
  })

  it('수평선 항목이 실제로 수평선을 넣고 메뉴를 닫습니다', async () => {
    ed = await mountEditor('<p>hello</p>')
    await settle()
    placeCaretInText(ed.editable, 5)
    await settle()

    await click(trigger())
    await click(item('Horizontal Rule'))

    expect(ed.editable.querySelector('hr'), '수평선이 안 들어갑니다').not.toBeNull()
    expect(menu(), '고른 뒤에도 열려 있습니다').toBeNull()
  })

  it('아래첨자·위첨자가 실제로 먹습니다', async () => {
    ed = await mountEditor('<p>hello</p>')
    await settle()

    selectAll(ed.editable)
    await click(trigger())
    await click(item('Subscript'))
    expect(ed.editable.querySelector('sub'), '아래첨자가 안 먹었습니다').not.toBeNull()

    selectAll(ed.editable)
    await click(trigger())
    await click(item('Superscript'))
    expect(ed.editable.querySelector('sup'), '위첨자가 안 먹었습니다').not.toBeNull()
  })
})
