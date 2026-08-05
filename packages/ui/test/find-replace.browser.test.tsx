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
})
