import { describe, it, expect, afterEach } from 'vitest'
import { userEvent } from '@vitest/browser/context'
import {
  mountEditor,
  settle,
  selectAll,
  placeCaretInText,
  click,
  button,
  dialog,
  isOpen,
  selectOption,
  type MountedEditor,
} from './harness'

/**
 * `#16` 에서 찾은 것입니다.
 *
 * 툴바 버튼을 누르면 포커스가 그 버튼으로 옮겨갑니다. 커맨드는 저장된 선택
 * 영역으로 동작하니 서식은 적용되지만, 편집 영역은 포커스를 잃은 채로 남아
 * 이어지는 타이핑이 사라졌습니다. `runCommand` 가 성공 후
 * `FOCUS_REQUESTED` 를 발행해 되돌립니다.
 */

function editorHasFocus(editable: HTMLElement): boolean {
  const active = document.activeElement
  return active === editable || editable.contains(active)
}

describe('커맨드 후 포커스 복귀', () => {
  let ed: MountedEditor | null = null

  afterEach(() => {
    ed?.unmount()
    ed = null
  })

  it('목록을 만든 뒤 이어서 친 글자가 항목 안으로 들어가야 함', async () => {
    ed = await mountEditor('<p>list me</p>')
    // 캐럿을 글 끝에 둡니다. 전체 선택 상태로 두면 이어 친 글자가 선택을
    // 덮어써서, 포커스가 돌아왔는지와 구분되지 않습니다.
    placeCaretInText(ed.editable, 7)
    await settle()

    await click(button(ed.root, 'List'))
    const menu = dialog('List type')
    const numbered = [...menu.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Numbered')
    )!
    await click(numbered)
    await settle(6)

    expect(editorHasFocus(ed.editable)).toBe(true)

    await userEvent.keyboard('XYZ')
    await settle(4)

    // 이 수정 전에는 키 입력이 통째로 사라졌습니다
    expect(ed.editable.innerHTML).toMatch(/<li>list meXYZ<\/li>/)
  })

  it('정렬 뒤에도 포커스가 돌아오고 입력이 이어져야 함', async () => {
    ed = await mountEditor('<p>align me</p>')
    selectAll(ed.editable)
    await settle()

    const before = ed.editable.innerHTML
    await click(button(ed.root, 'Align Center'))
    await settle(6)

    expect(editorHasFocus(ed.editable)).toBe(true)

    await userEvent.keyboard('ABC')
    await settle(4)
    expect(ed.editable.innerHTML).not.toBe(before)
  })

  it('Bold 뒤에도 포커스가 돌아와야 함', async () => {
    ed = await mountEditor('<p>bold me</p>')
    selectAll(ed.editable)
    await settle()

    await click(
      ed.root.querySelector<HTMLButtonElement>('button[aria-label="Bold"]')!
    )
    await settle(6)

    expect(editorHasFocus(ed.editable)).toBe(true)
  })

  it('셀렉트는 포커스를 빼앗기지 않아야 함', async () => {
    // 포커스를 되돌리면 열려 있던 드롭다운이 닫힙니다.
    // 커맨드가 성공했을 때만 발행하므로 여기까지 번지지 않아야 합니다.
    ed = await mountEditor('<p>size me</p>')
    selectAll(ed.editable)
    await settle()

    await selectOption(
      ed.root.querySelector<HTMLSelectElement>('select[title="Line Height"]')!,
      '2'
    )

    expect(ed.editable.innerHTML).toMatch(/line-height:\s*2/i)
  })

  it('다이얼로그는 열린 채로 남아야 함', async () => {
    ed = await mountEditor('<p>dlg</p>')
    placeCaretInText(ed.editable)
    await settle()

    await click(button(ed.root, 'Insert Table'))
    const dlg = dialog('Insert Table')

    expect(isOpen(dlg)).toBe(true)
    dlg.close()
  })
})
