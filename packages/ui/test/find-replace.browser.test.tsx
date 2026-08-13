import { describe, it, expect, afterEach } from 'vitest'
import {
  mountEditor,
  settle,
  click,
  button,
  dialog,
  fillInput,
  type MountedEditor,
} from './harness'

/**
 * `docs/find-dialog.md` 의 결론을 지킵니다.
 *
 * 체크박스를 바꾸면 다시 찾아야 합니다. 이전에는 `useEffect` 가 상태 변화를
 * 보고 처리했는데, 지금은 체크박스 핸들러가 바뀐 값을 직접 넘깁니다.
 * 핸들러가 `runFind` 를 부르지 않으면 여기서 잡힙니다.
 */
describe('찾기/바꾸기', () => {
  let ed: MountedEditor | null = null

  afterEach(() => {
    const open = document.querySelector<HTMLDialogElement>('dialog[open]')
    open?.close()
    ed?.unmount()
    ed = null
  })

  const matches = (dlg: HTMLElement): string =>
    dlg.textContent?.match(/\d+ of \d+ matches|No matches found/)?.[0] ?? '표시 없음'

  const openFind = async (
    root: HTMLElement,
    query: string
  ): Promise<HTMLDialogElement> => {
    await click(button(root, 'Find & Replace'))
    const dlg = dialog('Find & Replace')
    await fillInput(
      dlg.querySelector<HTMLInputElement>('input[type="text"]')!,
      query
    )
    const find = [...dlg.querySelectorAll('button')].find(
      (b) => b.textContent?.trim() === 'Find'
    )!
    await click(find)
    await settle(6)
    return dlg
  }

  const toggle = async (
    dlg: HTMLElement,
    label: string,
    checked: boolean
  ): Promise<void> => {
    const box = [...dlg.querySelectorAll('label')]
      .find((l) => l.textContent?.includes(label))!
      .querySelector<HTMLInputElement>('input[type="checkbox"]')!
    box.checked = checked
    box.dispatchEvent(new Event('change', { bubbles: true }))
    await settle(8)
  }

  it('대소문자 구분을 켜면 다시 찾아야 함', async () => {
    ed = await mountEditor('<p>Foo bar foo baz FOO</p>')
    const dlg = await openFind(ed.root, 'foo')

    expect(matches(dlg)).toBe('1 of 3 matches')

    await toggle(dlg, 'Case sensitive', true)
    expect(matches(dlg)).toBe('1 of 1 matches')

    await toggle(dlg, 'Case sensitive', false)
    expect(matches(dlg)).toBe('1 of 3 matches')
  })

  it('단어 단위를 켜면 다시 찾아야 함', async () => {
    ed = await mountEditor('<p>cat category cat</p>')
    const dlg = await openFind(ed.root, 'cat')

    expect(matches(dlg)).toBe('1 of 3 matches')

    await toggle(dlg, 'Whole word', true)
    expect(matches(dlg)).toBe('1 of 2 matches')
  })

  it('검색어가 없으면 체크박스를 바꿔도 찾지 않아야 함', async () => {
    ed = await mountEditor('<p>아무 글</p>')
    await click(button(ed.root, 'Find & Replace'))
    const dlg = dialog('Find & Replace')

    await toggle(dlg, 'Case sensitive', true)

    // 빈 검색어로 찾으면 "No matches found" 가 뜹니다. 아예 돌지 않아야 합니다.
    expect(matches(dlg)).toBe('표시 없음')
  })

  it('다음/이전으로 표시 번호가 돌아야 함', async () => {
    ed = await mountEditor('<p>a b a b a</p>')
    const dlg = await openFind(ed.root, 'a')
    expect(matches(dlg)).toBe('1 of 3 matches')

    const press = async (name: string): Promise<void> => {
      const btn = [...dlg.querySelectorAll('button')].find((b) =>
        b.textContent?.includes(name)
      )!
      await click(btn)
      await settle(4)
    }

    await press('Next')
    expect(matches(dlg)).toBe('2 of 3 matches')
    await press('Next')
    expect(matches(dlg)).toBe('3 of 3 matches')
    await press('Next')
    expect(matches(dlg)).toBe('1 of 3 matches')
    await press('Prev')
    expect(matches(dlg)).toBe('3 of 3 matches')
  })

  /**
   * ## 대조군에서 안 물던 둘
   *
   * Svelte 로 옮기며 사보타주를 돌렸더니 두 가지가 **아무 검사도 안 걸렸습니다.**
   *
   * | 사보타주 | 결과 |
   * | --- | --- |
   * | 닫을 때 강조 정리를 지움 | 17개 전부 통과 |
   * | Enter 로 다음 찾기를 지움 | 17개 전부 통과 |
   *
   * 둘 다 원래 없던 검사입니다. 특히 첫째는 Preact 판 주석이 **일부러 짚어
   * 두었던 것**입니다 — "Esc 든 Close 버튼이든 어느 경로로 닫혀도 강조가
   * 정리되도록" 이라고 적혀 있는데, 정작 그걸 지키는 검사는 없었습니다.
   */
  it('닫으면 강조가 정리됩니다', async () => {
    ed = await mountEditor('<p>hello hello hello</p>')
    const dlg = await openFind(ed.root, 'hello')
    expect(matches(dlg)).toBe('1 of 3 matches')

    /* 강조는 `find-highlight` 클래스로 편집 영역에 남습니다 */
    expect(ed.editable.innerHTML, '강조가 안 걸렸습니다').toContain(
      'find-highlight'
    )

    dlg.close()
    await settle(4)

    expect(ed.editable.innerHTML, '닫았는데 강조가 남았습니다').not.toContain(
      'find-highlight'
    )
  })

  it('Enter 로 다음 일치로 넘어갑니다', async () => {
    ed = await mountEditor('<p>hello hello hello</p>')
    const dlg = await openFind(ed.root, 'hello')
    expect(matches(dlg)).toBe('1 of 3 matches')

    const input = dlg.querySelector<HTMLInputElement>('input[type="text"]')!
    input.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })
    )
    await settle(4)

    expect(matches(dlg), 'Enter 가 다음으로 안 넘어갑니다').toBe(
      '2 of 3 matches'
    )
  })
})
