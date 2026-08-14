import { describe, it, expect, afterEach } from 'vitest'
import {
  mountEditor,
  placeCaretInText,
  selectAll,
  settle,
  click,
  dialog,
  isOpen,
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
 * 이주 중에는 고치지 않고 두었습니다 — 동작을 같게 두는 것이 먼저였고,
 * 다이얼로그들이 전부 kinu `Dialog` 라 열 수단이 없었습니다.
 *
 * **지금은 다섯을 이었습니다.** 링크·이미지·표·특수문자·찾기가 실제로
 * 다이얼로그를 엽니다 (아래 `다섯 항목이 다이얼로그를 엽니다`). 줄 간격·자간
 * 둘은 `<select>` 라 여는 수단이 마땅치 않아 아직 빈 항목입니다.
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

  /**
   * ## 좁은 화면에서는 이 메뉴가 유일한 길입니다
   *
   * 툴바에서 이 다이얼로그들의 트리거는 좁은 화면에서 감춰집니다. 그래서
   * 메뉴 항목이 실제로 다이얼로그를 열어야 합니다.
   *
   * ### 감추는 자리를 옮겨야 했습니다
   *
   * 예전에는 툴바가 컴포넌트를 통째로 `[data-part="mobile-hidden"]` 안에
   * 넣었고 그 규칙이 `display: none` 입니다. 그러면 안의 `<dialog>` 까지
   * 안 그려집니다 — 재 보면 `showModal()` 은 성공하고 `open` 도 붙는데
   * 크기가 **0×0** 입니다. 이으려면 감추는 표시를 **버튼에** 옮겨야 했습니다.
   */
  it.each([
    ['Link', 'Insert Link'],
    ['Image', 'Insert Image'],
    ['Table', 'Insert Table'],
    ['Special Character', 'Insert Special Character'],
    ['Find & Replace', 'Find & Replace'],
  ])('%s 항목이 다이얼로그를 엽니다', async (label, dialogName) => {
    ed = await mountEditor('<p>hello</p>')
    placeCaretInText(ed.editable, 1)
    await settle(6)

    await click(trigger())
    await click(item(label))
    await settle(6)

    const dlg = dialog(dialogName)
    expect(isOpen(dlg), `${label} 이 다이얼로그를 안 엽니다`).toBe(true)

    /* 다이얼로그가 실제로 **보여야** 합니다 — 0×0 이면 연 것이 아닙니다 */
    const box = dlg.getBoundingClientRect()
    expect(box.width, '다이얼로그가 안 보입니다').toBeGreaterThan(0)
    expect(box.height).toBeGreaterThan(0)

    expect(menu(), '다이얼로그를 열었는데 메뉴가 남았습니다').toBeNull()
    dlg.close()
  })

  /**
   * ## 좁은 화면에서 트리거가 정말 감춰져야 합니다
   *
   * 이 메뉴가 "유일한 길" 인 것은 툴바의 트리거들이 감춰지기 때문입니다.
   * 감추기가 풀리면 메뉴를 이은 의미도 절반이 없어지므로 같이 봅니다.
   *
   * 감추는 표시를 컨테이너에서 **버튼으로** 옮겼기 때문에, 감춘 뒤에도
   * 다이얼로그는 열려야 합니다 — 그 둘을 한 검사에서 확인합니다.
   */
  it('좁은 화면에서 트리거는 감춰지고 메뉴로는 열려야 합니다', async () => {
    ed = await mountEditor('<p>hello</p>')
    ed.root.style.width = '380px'
    placeCaretInText(ed.editable, 1)
    await settle(8)

    const linkButton = ed.root.querySelector<HTMLElement>(
      'button[aria-label="Insert Link"]'
    )!
    expect(linkButton, '링크 버튼이 아예 없습니다').not.toBeNull()
    expect(
      getComputedStyle(linkButton).display,
      '좁은 화면인데 트리거가 그대로 보입니다'
    ).toBe('none')

    /* 더보기 트리거는 반대로 보여야 합니다 */
    expect(getComputedStyle(trigger()).display).not.toBe('none')

    await click(trigger())
    await click(item('Link'))
    await settle(6)

    const dlg = dialog('Insert Link')
    expect(isOpen(dlg)).toBe(true)
    /* 감춘 컨테이너 안이면 여기서 0 이 됩니다 */
    expect(
      dlg.getBoundingClientRect().width,
      '감춘 자리에 갇혀 안 보입니다'
    ).toBeGreaterThan(0)
    dlg.close()
  })
})
