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
import { List, ListOrdered } from 'lucide'
import type { IconNode } from 'lucide'
import { icon } from '../src/elements/icon'
import { ExportEvents } from 'sagak-core'

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

    /**
     * ## 대조군에서 안 물던 것 — **내보내기가 실제로 나가는지**
     *
     * Export 메뉴를 옮기며 사보타주를 돌렸더니 지금까지 중 가장 큰 구멍이
     * 나왔습니다.
     *
     * | 사보타주 | 결과 |
     * | --- | --- |
     * | 고른 형식을 무시하고 항상 `html` | 175개 전부 통과 |
     * | 발행 자체를 **삭제** | 175개 전부 통과 |
     *
     * 있던 검사는 "열리고 항목이 셋이고 누르면 닫힌다" 까지였습니다. 메뉴가
     * 여닫히는 것만 보고 있었던 셈이라, **Markdown 을 눌러도 아무 일이 안
     * 일어나는 상태**가 검사를 다 통과합니다.
     */
    it('고른 형식이 그대로 발행되어야 함', async () => {
      ed = await mountEditor()
      const sent: unknown[] = []
      const off = ed.context.eventBus.on(
        ExportEvents.EXPORT_DOWNLOAD,
        'after',
        (payload?: unknown) => {
          sent.push(payload)
        }
      )

      /* 형식 이름은 아래 `toEqual` 에서 순서대로 확인합니다 */
      for (const label of ['HTML', 'Markdown', 'Plain Text']) {
        await click(button(ed.root, 'Export'))
        const menu = dialog('Export as')
        /* 이름과 설명이 각각 `<span>` 이라 이름 쪽만 정확히 맞춥니다 */
        const item = [...menu.querySelectorAll('button')].find((b) =>
          [...b.querySelectorAll('span')].some(
            (s) => s.textContent?.trim() === label
          )
        )!
        expect(item, `${label} 항목을 찾지 못했습니다`).toBeDefined()
        await click(item)
        await settle(6)
      }

      off()
      expect(sent, '고른 형식이 그대로 안 나갑니다').toEqual([
        { format: 'html', filename: 'document' },
        { format: 'markdown', filename: 'document' },
        { format: 'text', filename: 'document' },
      ])
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

    /**
     * ## 대조군에서 안 물던 것 — 지금 상태를 보여주는 일
     *
     * 목록 메뉴를 옮기며 사보타주를 돌렸더니, **여는 것과 닫는 것만** 검사가
     * 물었습니다. 지금 어떤 목록 안에 있는지 알려 주는 셋은 지워도 172개가
     * 그대로 통과했습니다 — 버튼의 켜짐 표시, 버튼의 아이콘, 메뉴에서 고른
     * 항목 표시.
     *
     * 셋 다 화면에서 바로 보이는 것들입니다. 목록 안에 있는데도 툴바 버튼이
     * 꺼져 보이고, 번호 목록인데 글머리 아이콘이 뜨고, 메뉴를 열어도 어느
     * 쪽인지 표시가 없는 상태가 **검사를 다 통과합니다.**
     */
    it.each([
      ['<ul><li>bullet</li></ul>', List, 'Bullet', 'Numbered'],
      ['<ol><li>numbered</li></ol>', ListOrdered, 'Numbered', 'Bullet'],
    ])(
      '%s 안에서는 버튼과 메뉴가 지금 갈래를 보여야 함',
      async (html, expected, selectedLabel, otherLabel) => {
        ed = await mountEditor(html as string)
        /*
         * 캐럿을 **마운트가 끝난 뒤** 옮깁니다. `SvelteHost` 는 한 틱 늦게
         * 띄우므로, 먼저 옮기면 구독이 붙기 전에 이벤트가 지나갑니다.
         */
        await settle(6)
        placeCaretInText(ed.editable, 1)
        await settle(6)

        const trigger = button(ed.root, 'List')

        expect(
          trigger.getAttribute('data-state'),
          '목록 안인데 버튼이 꺼져 보입니다'
        ).toBe('on')
        expect(
          trigger.querySelector('svg')!.outerHTML,
          '지금 갈래와 아이콘이 다릅니다'
        ).toBe(icon(expected as IconNode, 16).outerHTML)

        await click(trigger)
        const menu = dialog('List type')
        const item = (text: string): HTMLButtonElement =>
          [...menu.querySelectorAll('button')].find((b) =>
            b.textContent?.includes(text)
          )!

        expect(
          item(selectedLabel as string).hasAttribute('selected'),
          '고른 항목에 표시가 없습니다'
        ).toBe(true)
        expect(item(otherLabel as string).hasAttribute('selected')).toBe(false)
        menu.close()
      }
    )

    /**
     * ## 갈래를 **바꾼 직후**는 검사에 안 넣었습니다 — 이주 전부터 어긋납니다
     *
     * 원래는 위 검사에서 글머리 → 번호로 바꾼 뒤 셋이 따라오는지까지 보려
     * 했는데 통과하지 못했습니다. 재 보니 이렇습니다.
     *
     * ```
     * BEFORE  state=on
     * AFTER   state=null  html=<ol><li>bullet</li></ol>  anchorParent=DIV
     * ```
     *
     * 문서는 제대로 바뀌는데 **캐럿이 새 `<li>` 안이 아니라 편집 영역
     * `<div>` 에 얹힙니다.** 그러면 `getCurrentListType()` 이 위로 올라가도
     * `OL` 을 못 만나 '없음' 이 됩니다 — 눈에는 번호 목록 안인데 툴바 버튼은
     * 꺼져 보입니다.
     *
     * **이주가 만든 것이 아닙니다.** 툴바를 Preact 판으로 되돌려 같은 것을
     * 재 봤고 네 시점(2·8·20·40 프레임) 모두 똑같았습니다. 이주는 동작을 같게
     * 두는 것이 먼저라 여기서 고치지 않고, 있는 그대로 적어 둡니다.
     */

    /**
     * 드롭다운의 위치는 **CSS 앵커**가 잡습니다 — `[k=dropdown]` 안의
     * `[commandfor]` 가 기준점이 되고 메뉴가 그 아래에 붙습니다. 속성을
     * 빠뜨리면 메뉴가 화면 왼쪽 위로 떨어지는데, 그래도 172개가 통과했습니다.
     *
     * 재 본 값입니다 — 트리거 바로 아래 왼쪽 맞춤, 위로 `0.25rem` 띄움.
     */
    it('목록 메뉴가 버튼 아래에 붙어야 함', async () => {
      ed = await mountEditor()
      const trigger = button(ed.root, 'List')
      await click(trigger)

      const menu = dialog('List type')
      const t = trigger.getBoundingClientRect()
      const m = menu.getBoundingClientRect()

      expect(Math.round(m.left - t.left), '왼쪽이 안 맞습니다').toBe(0)
      expect(Math.round(m.top - t.bottom), '버튼 아래가 아닙니다').toBe(4)
      /* `min-width: max(13.5rem, anchor-size(width))` */
      expect(m.width).toBeGreaterThanOrEqual(216)

      menu.close()
    })
  })

  it('base-ui 흔적이 남아 있지 않아야 함', async () => {
    ed = await mountEditor()
    expect(
      document.querySelectorAll('[class*="base-ui"], [data-base-ui]').length
    ).toBe(0)
  })
})
