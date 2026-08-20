import { describe, it, expect, afterEach } from 'vitest'
import {
  mountEditor,
  settle,
  selectAll,
  placeCaretInText,
  placeCaret,
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
import { FALLBACK_FONTS } from '../src/components/font-family-select/font-family-select.shared'

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

    /**
     * ## 대조군에서 안 물던 것 — 넷 중 **하나만** 검사가 있었습니다
     *
     * 서식 토글을 Svelte 로 옮기며 사보타주를 돌렸더니, 굵게만 물고 기울임·
     * 밑줄·취소선은 상태 반영을 통째로 지워도 176개가 그대로 통과했습니다.
     * 굵게 아이콘의 획 두께(`stroke-width: 2.5`)도 마찬가지입니다 — 되돌리면
     * 그 버튼만 가늘어 보이는데 아무것도 안 걸립니다.
     */
    it('네 토글이 각자 자기 서식만 눌린 것으로 보여야 함', async () => {
      ed = await mountEditor(
        '<p><strong>굵게</strong><em>기울임</em><u>밑줄</u><s>취소선</s></p>'
      )
      await settle(6)

      const pressed = (label: string): string | null =>
        ed!.root
          .querySelector(`button[aria-label="${label}"]`)!
          .getAttribute('aria-pressed')

      for (const [selector, label] of [
        ['strong', 'Bold'],
        ['em', 'Italic'],
        ['u', 'Underline'],
        ['s', 'Strikethrough'],
      ]) {
        const range = document.createRange()
        range.selectNodeContents(ed.editable.querySelector(selector)!)
        const selection = window.getSelection()
        selection?.removeAllRanges()
        selection?.addRange(range)
        document.dispatchEvent(new Event('selectionchange'))
        await settle(6)

        expect(pressed(label), `${label} 이 안 눌린 것으로 보입니다`).toBe(
          'true'
        )
        for (const other of ['Bold', 'Italic', 'Underline', 'Strikethrough']) {
          if (other === label) continue
          expect(pressed(other), `${label} 인데 ${other} 도 눌렸습니다`).toBe(
            'false'
          )
        }
      }
    })

    it('굵게 아이콘만 획이 두꺼워야 함', async () => {
      ed = await mountEditor()
      const stroke = (label: string): string | null =>
        ed!.root
          .querySelector(`button[aria-label="${label}"] svg`)!
          .getAttribute('stroke-width')

      expect(stroke('Bold'), '굵게 아이콘이 가늘어졌습니다').toBe('2.5')
      expect(stroke('Italic')).toBe('2')
    })

    /**
     * ## 전체 선택(⌘A)에서 툴바가 지금 서식을 못 읽고 있었습니다
     *
     * 있던 검사는 **누른 뒤**를 봤습니다 — 전부 고르고 굵게를 누르면
     * `aria-pressed` 가 `true` 가 되는지. 이미 굵은 글을 **골랐을 때** 눌린
     * 것으로 보이는지는 아무도 안 봤습니다.
     *
     * 재 보니 툴바가 꺼져 보였습니다. 조회가 `startContainer` 를 기준으로
     * 하는데, `selectNodeContents(편집영역)` 은 그것이 편집 영역 `<div>` 라
     * 조상 탐색이 내용을 건너뛰고 위로 올라갑니다. 캐럿·드래그는 텍스트
     * 노드라 원래부터 맞았고 **⌘A 만** 틀렸습니다.
     *
     * 고친 자리는 `sagak-core` 의 `native-query` 입니다. 여기서는 그 결과가
     * **사용자 눈에 닿는지**를 봅니다.
     */
    it('이미 굵은 글을 전부 고르면 굵게가 눌린 것으로 보여야 함', async () => {
      ed = await mountEditor('<p><strong>굵은 글자만</strong></p>')
      await settle(6)
      selectAll(ed.editable)
      await settle(8)

      const bold = ed.root.querySelector<HTMLButtonElement>(
        'button[aria-label="Bold"]'
      )!
      expect(
        bold.getAttribute('aria-pressed'),
        '전부 굵은데 굵게가 꺼져 보입니다'
      ).toBe('true')
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

    /**
     * 글자 크기 메뉴는 **따라가는** 드롭다운입니다 — 고른 글자의 크기를
     * 보여줘야 합니다. `native-query` 를 고치기 전에는 전체 선택에서 늘
     * `12`(스케일 `3`)를 가리켰습니다.
     *
     * ## 이 검사는 한동안 거짓말을 못 박고 있었습니다
     *
     * `<font size="5">` 는 24px 인데 메뉴는 `18` 을 보여줬고, 검사가 그
     * `18` 을 맞다고 적어 두었습니다. 값이 `execCommand` 의 1~7 스케일이라
     * 라벨과 실제 크기가 어긋나 있었기 때문입니다 — 여덟 라벨 중 일곱이
     * 틀렸습니다.
     *
     * 지금은 라벨이 곧 값(`'24px'`)이라 24px 짜리 글은 `24` 로 보입니다.
     */
    it('고른 글자의 크기를 가리켜야 함', async () => {
      ed = await mountEditor('<p><font size="5">큰 글자</font></p>')
      await settle(6)
      selectAll(ed.editable)
      await settle(8)

      const size = ed.root.querySelector<HTMLSelectElement>(
        'select[title="Font Size"]'
      )!
      expect(size.value, '고른 글자의 크기를 안 따라갑니다').toBe('24px')
      expect(
        size.selectedOptions[0]?.textContent,
        '24px 인데 다른 숫자를 보여줍니다'
      ).toBe('24')
    })

    /**
     * ## 고른 숫자가 곧 크기여야 합니다
     *
     * 예전에는 `36` 을 고르면 48px 이 됐습니다. 라벨은 px 인데 값은 1~7
     * 스케일이라, 실제 크기(10·13·16·18·24·32·48)와 라벨(9·10·11·12·14·
     * 18·24·36)이 아예 다른 줄이었습니다.
     */
    it.each([
      ['9', '9px'],
      ['10', '10px'],
      ['12', '12px'],
      ['36', '36px'],
    ])('%s 를 고르면 %s 가 됩니다', async (label, expected) => {
      ed = await mountEditor('<p>크기</p>')
      await settle(6)
      selectAll(ed.editable)
      await settle()

      await selectOption(
        ed.root.querySelector<HTMLSelectElement>('select[title="Font Size"]')!,
        expected
      )
      await settle(3)

      const styled = ed.editable.querySelector('span, font') as HTMLElement
      expect(
        getComputedStyle(styled).fontSize,
        `${label} 을 골랐는데 다른 크기입니다`
      ).toBe(expected)
    })

    /**
     * ## 9 와 10 이 같은 값이었습니다
     *
     * 1~7 스케일에 그 사이가 없어서 둘 다 `'1'` 이었고, 9 를 골라도 메뉴는
     * 10 을 가리켰습니다. 라벨이 곧 값이 되면서 없어진 문제입니다.
     */
    it('9 와 10 이 서로 다른 값입니다', async () => {
      ed = await mountEditor('<p>크기</p>')
      await settle(6)

      const options = [
        ...ed.root.querySelectorAll<HTMLOptionElement>(
          'select[title="Font Size"] option'
        ),
      ]
      const values = options.map((option) => option.value)

      expect(new Set(values).size, '값이 겹치는 항목이 있습니다').toBe(
        values.length
      )
    })

    /**
     * ## 목록에 없는 크기는 그대로 보여줍니다
     *
     * 서식 없는 글은 15px 이라 목록(9·10·11·12·14·18·24·36)에 없습니다.
     * 예전에는 1~7 중 가까운 칸으로 눌러 답해서 `12` 를 가리켰습니다 —
     * **가장 흔한 경우가 가장 크게 틀렸습니다.**
     */
    it('목록에 없는 크기도 실제 값을 보여줍니다', async () => {
      ed = await mountEditor('<p>기본 글</p>')
      await settle(6)
      selectAll(ed.editable)
      await settle(8)

      const size = ed.root.querySelector<HTMLSelectElement>(
        'select[title="Font Size"]'
      )!
      const px = getComputedStyle(ed.editable).fontSize

      expect(size.value, '실제 크기를 안 가리킵니다').toBe(px)
      expect(size.selectedOptions[0]?.textContent).toBe(
        String(Math.round(parseFloat(px)))
      )
    })

    /**
     * ## 대조군에서 안 물던 것 — 글꼴 메뉴가 지금 글꼴을 가리키는지
     *
     * 폰트 메뉴를 Svelte 로 옮기며 상태 구독을 통째로 지워도
     * 182개가 그대로 통과했습니다. 고른 뒤에 메뉴가 그 값을 가리키는 것은
     * `bind:value` 라 저절로 되고, **글에 이미 걸린 글꼴을 읽어 오는 쪽**은
     * 아무도 안 보고 있었습니다.
     *
     * 명조 글자에 커서를 두면 메뉴가 `Serif` 를 가리켜야 합니다.
     *
     * 내용에 글꼴 스택을 직접 적을 때는 **작은따옴표로 감싸야** 합니다 —
     * 스택 안에 큰따옴표가 들어 있어서, 큰따옴표로 감싸면 속성이 중간에
     * 끊기고 소독기가 빈 `font-family:` 만 남깁니다. 처음에 그렇게 재 보고
     * 컴포넌트를 의심했었습니다.
     */
    it('글에 걸린 글꼴을 메뉴가 가리켜야 함', async () => {
      const serif = FALLBACK_FONTS[1]
      ed = await mountEditor(
        `<p><span style='font-family: ${serif.value}'>명조 글자</span></p>`
      )
      await settle(8)

      const menu = ed.root.querySelector<HTMLSelectElement>(
        'select[title="Font Family"]'
      )!

      selectAll(ed.editable)
      await settle(10)
      expect(menu.value, '전체 선택에서 글꼴을 안 따라갑니다').toBe(serif.value)
      expect(menu.selectedOptions[0]?.textContent).toBe('Serif')

      placeCaretInText(ed.editable, 1)
      await settle(10)
      expect(menu.value, '캐럿에서 글꼴을 안 따라갑니다').toBe(serif.value)
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

      /*
       * 여는 순간 기존 URL 을 읽어 오는지.
       *
       * **입력칸을 먼저 비워야 합니다.** 예전에는 안 비우고 바로 다시 열어
       * 값을 봤는데, 방금 친 값이 그대로 남아 있어서 **미리 채우기를 통째로
       * 지워도 통과**했습니다. 안에서만 맞는 검사였습니다.
       */
      const field = dlg.querySelector<HTMLInputElement>('input')!
      await fillInput(field, '')

      // `getSelectedLink()` 는 위로 올라가므로 캐럿이 링크 글자 안이어야 합니다
      placeCaretInText(ed.editable, 2)
      await settle()
      await click(button(ed.root, 'Insert Link'))
      expect(field.value, '기존 URL 을 안 읽어 옵니다').toContain('example.com')
      dlg.close()
    })

    /**
     * ## 대조군에서 안 물던 둘
     *
     * 링크 다이얼로그를 Svelte 로 옮기며 사보타주를 돌렸더니 셋 중 셋이
     * 안 물었습니다. 하나(미리 채우기)는 위 검사를 고쳐서 살렸고, 나머지
     * 둘은 검사가 아예 없었습니다.
     *
     * - 캐럿이 링크 위에 있을 때 툴바 버튼이 켜지는 것
     * - 지우기 전에 링크 전체를 범위로 다시 잡는 것
     *
     * 둘째가 특히 조용합니다. 범위를 안 잡으면 캐럿만 얹힌 채로 해제 이벤트가
     * 나가서 **아무것도 안 지워집니다.**
     */
    it('캐럿이 링크 위면 버튼이 켜지고, 지우기가 링크를 없애야 함', async () => {
      ed = await mountEditor('<p>앞 <a href="https://example.com">링크</a> 뒤</p>')
      await settle(6)

      const trigger = button(ed.root, 'Insert Link')

      /* 링크 밖 — 꺼져 있어야 합니다 */
      placeCaretInText(ed.editable, 1)
      await settle(8)
      expect(trigger.getAttribute('data-state')).toBeNull()

      /* 링크 안 — 켜져야 합니다 */
      const linkText = ed.editable.querySelector('a')!.firstChild!
      placeCaret(linkText, 1)
      await settle(8)
      expect(
        trigger.getAttribute('data-state'),
        '링크 위인데 버튼이 꺼져 보입니다'
      ).toBe('on')

      await click(trigger)
      const dlg = dialog('Insert Link')
      const removeButton = [...dlg.querySelectorAll('button')].find(
        (b) => b.textContent?.trim() === 'Remove'
      )!
      await click(removeButton)
      await settle(8)

      expect(ed.editable.innerHTML, '링크가 안 지워졌습니다').not.toMatch(/<a[\s>]/i)
      expect(ed.editable.textContent).toContain('링크')
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
    /**
     * 예전에는 **버스에 나간 요청**을 셌습니다. 내보내기가 모듈이 되면서 그
     * 요청이 없어졌으므로, 대신 **실제로 만들어지는 파일**을 봅니다 —
     * 재려던 것에 한 겹 더 가까워집니다.
     */
    it('고른 형식이 그대로 파일이 되어야 함', async () => {
      ed = await mountEditor()

      const files: { name: string; type: string; blob: Blob }[] = []
      const realCreate = URL.createObjectURL
      const realClick = HTMLAnchorElement.prototype.click
      let pending: Blob | null = null

      URL.createObjectURL = (blob: Blob) => {
        pending = blob

        return 'blob:test'
      }
      HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) {
        if (pending) {
          files.push({ name: this.download, type: pending.type, blob: pending })
        }
      }

      try {
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
      } finally {
        URL.createObjectURL = realCreate
        HTMLAnchorElement.prototype.click = realClick
      }

      expect(
        files.map((f) => [f.name, f.type]),
        '고른 형식이 그대로 안 나갑니다'
      ).toEqual([
        ['document.html', 'text/html'],
        ['document.md', 'text/markdown'],
        ['document.txt', 'text/plain'],
      ])

      /* 그리고 그 안에 진짜 글이 들어 있어야 합니다 */
      expect(await files[0].blob.text()).toContain('사각사각')
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
