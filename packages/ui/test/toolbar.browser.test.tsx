import { describe, it, expect, afterEach } from 'vitest'
import {
  mountEditor,
  settle,
  selectAll,
  placeCaretInText,
  click,
  button,
  dialog,
  isOpen,
  openDialogCount,
  fillInput,
  selectOption,
  type MountedEditor,
} from './harness'

/**
 * kinu 이전(#13·#14) 때 브라우저를 직접 몰아 확인했던 것들입니다.
 * 그때는 스크립트가 일회용이라 회귀를 막지 못했습니다.
 */
describe('툴바', () => {
  let ed: MountedEditor | null = null

  it('앱과 같은 구성으로 마운트되어야 함', async () => {
    ed = await mountEditor()
    expect(ed.root.querySelector('[data-scope="toolbar"]')).not.toBeNull()
    expect(ed.editable.innerHTML).toContain('사각사각')
  })

  afterEach(() => {
    ed?.unmount()
    ed = null
  })

  describe('Toggle (kinu ToggleGroup)', () => {
    it('Bold 를 적용하고 aria-pressed 를 반영해야 함', async () => {
      ed = await mountEditor('<p>hello world</p>')
      selectAll(ed.editable)
      await settle()

      const bold = ed.root.querySelector<HTMLButtonElement>(
        'button[aria-label="Bold"]'
      )!
      expect(bold.getAttribute('aria-pressed')).toBe('false')

      await click(bold)

      expect(ed.editable.innerHTML).toMatch(/<(b|strong)[\s>]/i)
      expect(bold.getAttribute('aria-pressed')).toBe('true')
    })

    it('세그먼트 모서리를 이어붙여야 함', async () => {
      ed = await mountEditor()
      const toggles = ed.root.querySelectorAll<HTMLElement>(
        '[k="toggle-group"] [k="toggle"]'
      )
      expect(toggles.length).toBeGreaterThan(1)

      const first = getComputedStyle(toggles[0])
      const last = getComputedStyle(toggles[toggles.length - 1])
      expect(first.borderTopRightRadius).toBe('0px')
      expect(last.marginLeft).toBe('-1px')
    })
  })

  describe('Select (네이티브)', () => {
    it('네이티브 <select> 여야 하고 option 에 폰트가 계산되어야 함', async () => {
      ed = await mountEditor()
      const sel = ed.root.querySelector<HTMLSelectElement>(
        'select[title="Font Family"]'
      )!
      expect(sel.tagName).toBe('SELECT')

      const serif = [...sel.options].find((o) => o.text === 'Serif')
      expect(serif, '폴백 목록에서 Serif 를 찾지 못했습니다').toBeDefined()
      // base-ui 를 걷어낼 때 "네이티브 select 는 option 폰트가 죽는다" 고
      // 근거 없이 단정했었습니다. 실제로는 적용됩니다.
      expect(getComputedStyle(serif!).fontFamily).toMatch(/AppleMyungjo/i)
    })

    it('줄 간격을 반영해야 함 (선택 영역 저장/복원)', async () => {
      ed = await mountEditor('<p>spacing test</p>')
      selectAll(ed.editable)
      await settle()

      await selectOption(
        ed.root.querySelector<HTMLSelectElement>(
          'select[title="Line Height"]'
        )!,
        '2'
      )

      expect(ed.editable.innerHTML).toMatch(/line-height:\s*2/i)
    })

    it('제목을 반영해야 함', async () => {
      ed = await mountEditor('<p>heading test</p>')
      selectAll(ed.editable)
      await settle()

      await selectOption(
        ed.root.querySelector<HTMLSelectElement>(
          'select[title="Paragraph Style"]'
        )!,
        '2'
      )

      expect(ed.editable.innerHTML).toMatch(/<h2[\s>]/i)
    })
  })

  describe('Dialog (kinu, 네이티브 <dialog>)', () => {
    it('표를 삽입하고 닫혀야 함', async () => {
      ed = await mountEditor('<p>table here</p>')
      // 표는 캐럿 위치에 삽입합니다. 전체 선택 상태면 그 내용을 덮어씁니다.
      placeCaretInText(ed.editable, 5)
      await settle()

      await click(button(ed.root, 'Insert Table'))
      const dlg = dialog('Insert Table')
      expect(isOpen(dlg)).toBe(true)

      const insert = [...dlg.querySelectorAll('button')].find(
        (b) => b.textContent?.trim() === 'Insert'
      )!
      await click(insert)
      await settle(6)

      // 표가 생기면 커서가 안으로 들어가 aria-label 이 'Edit Table' 로 바뀝니다
      expect(openDialogCount()).toBe(0)
      expect(ed.editable.innerHTML).toMatch(/<table/i)
      expect((ed.editable.innerHTML.match(/<tr/gi) || []).length).toBe(3)
    })

    it('특수문자 탭을 전환하고 문자를 삽입해야 함', async () => {
      ed = await mountEditor('<p>char: </p>')
      const paragraph = ed.editable.querySelector('p')!
      const range = document.createRange()
      range.selectNodeContents(paragraph)
      range.collapse(false)
      const selection = window.getSelection()
      selection?.removeAllRanges()
      selection?.addRange(range)
      await settle()

      await click(button(ed.root, 'Insert Special Character'))
      const dlg = dialog('Insert Special Character')
      expect(isOpen(dlg)).toBe(true)

      const greek = [...dlg.querySelectorAll('button')].find(
        (b) => b.textContent?.trim() === 'Greek'
      )!
      await click(greek)
      expect(greek.getAttribute('aria-selected')).toBe('true')

      const alpha = dlg.querySelector<HTMLButtonElement>('button[title="α"]')!
      expect(alpha).not.toBeNull()
      await click(alpha)
      await settle(6)

      expect(isOpen(dlg)).toBe(false)
      expect(ed.editable.textContent).toContain('α')
    })

    /**
     * ## 대조군에서 안 물던 것 — 탭 줄의 생김새
     *
     * Svelte 로 옮기며 `k="tablist"`·`k="tab"`·`k="button"` 을 전부 떼어도
     * 163개가 그대로 통과했습니다. 화면에서는 탭 줄이 무너져 기본 버튼들이
     * 세로로 늘어서고 문자 칸이 40px 에서 21px 로 쪼그라드는데도요.
     *
     * 링크·이미지 다이얼로그에서 이미 한 번 겪은 회귀입니다 (`k` 를 안 달아
     * 테마를 안 따라갔던 것). **옮기는 동안 생김새가 갈리지 않는 것**이 검사로
     * 남아 있어야 합니다.
     *
     * 재 본 값들입니다.
     *
     * | | `k` 있음 | `k` 없음 |
     * | --- | --- | --- |
     * | 탭 줄 `display` | `flex` | `block` |
     * | 문자 칸 | 40×40 | 21px 높이 |
     * | 고른 표시 위치 | 3px → 194px | 없음(`content: none`) |
     *
     * 마지막 줄이 핵심입니다. kinu 의 탭 표시는 **순수 CSS**
     * (`anchor-name`/`position-anchor`)라 `aria-selected` 만 옮기면 따라옵니다.
     */
    it('특수문자 탭 줄이 kinu 생김새를 유지해야 함', async () => {
      ed = await mountEditor('<p>x</p>')
      await click(button(ed.root, 'Insert Special Character'))
      const dlg = dialog('Insert Special Character')

      const tabRow = dlg.querySelector('div')!
      expect(
        getComputedStyle(tabRow).display,
        '탭이 한 줄로 늘어서지 않습니다'
      ).toBe('flex')

      const indicator = (): string =>
        getComputedStyle(tabRow, ':before').insetInlineStart
      const startLeft = indicator()
      expect(startLeft, '고른 탭을 가리키는 표시가 없습니다').not.toBe('auto')

      const greek = [...tabRow.querySelectorAll('button')].find(
        (b) => b.textContent?.trim() === 'Greek'
      )!
      await click(greek)
      await settle(20)
      expect(indicator(), '표시가 고른 탭을 따라오지 않습니다').not.toBe(startLeft)

      /* 문자 칸은 `size="icon"` 이라 정사각형입니다 */
      const charButton = [...dlg.querySelectorAll('button')].find(
        (b) => b.getAttribute('title') === 'α'
      )!
      const box = charButton.getBoundingClientRect()
      expect(box.height, '문자 칸이 기본 버튼 높이로 쪼그라들었습니다').toBe(40)
      expect(box.width).toBe(40)

      dlg.close()
    })

    it('링크를 삽입하고, 다시 열면 기존 URL 을 미리 채워야 함', async () => {
      ed = await mountEditor('<p>link me</p>')
      selectAll(ed.editable)
      await settle()

      await click(button(ed.root, 'Insert Link'))
      const dlg = dialog('Insert Link')
      /*
       * **열렸는지**까지 봐야 합니다. `dialog()` 는 이름으로 요소를 찾을 뿐이라
       * 안 열려도 내용은 읽힙니다 — 실제로 `showModal()` 을 지워도 이 파일이
       * 전부 통과했습니다.
       */
      expect(isOpen(dlg), '다이얼로그가 안 열렸습니다').toBe(true)
      await fillInput(
        dlg.querySelector<HTMLInputElement>('input')!,
        'https://example.com'
      )
      const insert = [...dlg.querySelectorAll('button')].find(
        (b) => b.textContent?.trim() === 'Insert'
      )!
      await click(insert)
      await settle(6)

      expect(isOpen(dlg)).toBe(false)
      expect(ed.editable.innerHTML).toMatch(
        /<a[^>]+href="https:\/\/example\.com"/i
      )

      // handleOpen 이 다이얼로그가 열리기 전에 실행되는지.
      // getSelectedLink() 는 anchorNode 에서 위로 올라가므로 캐럿이 링크
      // 텍스트 안에 있어야 합니다.
      placeCaretInText(ed.editable, 2)
      await settle()
      await click(button(ed.root, 'Insert Link'))
      expect(dlg.querySelector<HTMLInputElement>('input')!.value).toContain(
        'example.com'
      )
    })

    it('찾기에서 일치 개수를 세고, Esc 로 닫으면 강조를 지워야 함', async () => {
      ed = await mountEditor('<p>foo bar foo baz</p>')
      await click(button(ed.root, 'Find & Replace'))
      const dlg = dialog('Find & Replace')
      expect(isOpen(dlg)).toBe(true)

      await fillInput(
        dlg.querySelector<HTMLInputElement>('input[type="text"]')!,
        'foo'
      )
      const find = [...dlg.querySelectorAll('button')].find(
        (b) => b.textContent?.trim() === 'Find'
      )!
      await click(find)
      await settle(6)

      expect(dlg.textContent).toMatch(/1 of 2 matches/)
      expect(dlg.querySelector('input[type="checkbox"]')).not.toBeNull()

      // 네이티브 close 이벤트에 정리 로직이 걸려 있는지 (#14)
      dlg.close()
      await settle(6)
      expect(ed.editable.innerHTML).not.toMatch(/<mark[^>]*>/i)
    })
  })

  describe('DropdownMenu (kinu)', () => {
    it('Export 메뉴를 열고 항목을 누르면 닫혀야 함', async () => {
      ed = await mountEditor()
      await click(button(ed.root, 'Export'))

      const menu = dialog('Export as')
      expect(isOpen(menu)).toBe(true)
      expect(menu.querySelectorAll('[k="dropdown-menu-item"]').length).toBe(3)

      const markdown = [...menu.querySelectorAll('button')].find((b) =>
        b.textContent?.includes('Markdown')
      )!
      await click(markdown)
      await settle(6)

      expect(isOpen(menu)).toBe(false)
    })

    it('목록 메뉴로 번호/글머리 목록을 만들어야 함', async () => {
      ed = await mountEditor('<p>list me</p>')
      selectAll(ed.editable)
      await settle()

      await click(button(ed.root, 'List'))
      const menu = dialog('List type')
      expect(isOpen(menu)).toBe(true)

      const numbered = [...menu.querySelectorAll('button')].find((b) =>
        b.textContent?.includes('Numbered')
      )!
      await click(numbered)
      await settle(6)

      expect(isOpen(menu)).toBe(false)
      expect(ed.editable.innerHTML).toMatch(/<ol[\s>]/i)
    })
  })

  it('base-ui 흔적이 남아 있지 않아야 함', async () => {
    ed = await mountEditor()
    expect(
      document.querySelectorAll('[class*="base-ui"], [data-base-ui]').length
    ).toBe(0)
  })
})
