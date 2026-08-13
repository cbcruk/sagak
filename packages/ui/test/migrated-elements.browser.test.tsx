import { describe, it, expect, afterEach } from 'vitest'
import {
  mountEditor,
  placeCaretInText,
  selectAll,
  settle,
  button,
  click,
  type MountedEditor,
} from './harness'

/**
 * nanotags 로 옮긴 툴바 컨트롤들이 **실제로 동작하는지** 봅니다.
 *
 * ## 왜 이 파일이 생겼나
 *
 * 1단계를 옮기고 테스트 135개가 전부 통과했는데, 대조군을 돌려 보니 둘이
 * 안 물었습니다.
 *
 * | 사보타주 | 결과 |
 * | --- | --- |
 * | 수평선 버튼이 아무것도 안 하게 | **135개 전부 통과** |
 * | 드롭다운이 선택 영역을 저장하지 않게 | **135개 전부 통과** |
 *
 * 이주 때문에 생긴 구멍이 아니라 **원래 없던 검사**입니다. 옮기기 전에도
 * 없었으니 그때 깨졌어도 몰랐을 것입니다.
 *
 * 수평선 쪽은 메웠습니다 — 아래 검사를 넣은 뒤 같은 사보타주가 실패합니다.
 *
 * ## 못 메운 것 — 선택 영역 저장
 *
 * `mousedown`/`focus` 의 `saveSelection()` 을 통째로 지워도 **여전히 139개가
 * 전부 통과합니다.** 아래 검사를 넣은 뒤에도 그렇습니다.
 *
 * 네이티브 `<select>` 로 포커스가 옮겨가도 `window.getSelection()` 이 살아
 * 있어서, 되돌릴 것이 없기 때문으로 보입니다. 즉 이 자리에서 저장/복원은
 * **방어적이지 관측되지는 않습니다.**
 *
 * 실패하는 경우를 못 만들었으므로 코드를 지우지 않고 그대로 뒀습니다 —
 * 이주는 동작을 같게 두는 것이 먼저이고, "안 깨지니 지워도 된다" 는 판단은
 * 재현을 만든 뒤에 할 일입니다. kinu 드롭다운(팝업이 포커스를 실제로
 * 가져가는 쪽)을 옮길 때 다시 봐야 합니다.
 */

let ed: MountedEditor | null = null

afterEach(() => {
  ed?.unmount()
  ed = null
})

const editable = (): HTMLElement => ed!.editable

async function choose(title: string, value: string): Promise<void> {
  const select = ed!.root.querySelector(
    `select[title="${title}"]`
  ) as HTMLSelectElement
  expect(select, `"${title}" 드롭다운을 찾지 못했습니다`).not.toBeNull()

  /*
   * 사용자가 하는 순서 그대로입니다 — 누르는 순간 포커스가 에디터를 떠나고,
   * 고른 뒤에 값이 적용됩니다. `mousedown` 을 빼면 선택 영역이 이미 풀린
   * 상태에서 적용되므로 이 순서가 검사의 핵심입니다.
   */
  select.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
  select.focus()
  select.value = value
  select.dispatchEvent(new Event('change', { bubbles: true }))
  await settle()
}

describe('옮긴 툴바 컨트롤', () => {
  it('수평선 버튼이 실제로 수평선을 넣습니다', async () => {
    ed = await mountEditor('<p>hello</p>')
    await settle()

    /* 사용자가 하듯 글 안에 캐럿을 둡니다 — 넣을 자리가 있어야 합니다 */
    placeCaretInText(editable(), 5)
    await settle()

    expect(editable().querySelector('hr')).toBeNull()

    await click(button(ed.root, 'Insert Horizontal Rule'))

    expect(
      editable().querySelector('hr'),
      '버튼은 있는데 수평선이 안 들어갑니다'
    ).not.toBeNull()
  })

  /**
   * 툴바를 누르면 포커스가 에디터를 떠나 선택 영역이 풀립니다. 저장해 뒀다가
   * 적용 직전에 되돌리지 않으면 **아무 데도 안 먹습니다.**
   *
   * 이 저장소가 예전에 여러 번 고쳤던 실패 모드라(`docs/selection-state.md`)
   * 옮긴 판에도 검사를 둡니다.
   */
  it('드롭다운이 포커스를 가져가도 고른 값이 글에 먹습니다', async () => {
    ed = await mountEditor('<p>hello world</p>')
    await settle()

    selectAll(editable())
    await choose('Line Height', '2')

    expect(
      editable().innerHTML,
      '선택 영역을 잃어버려 아무 데도 안 먹었습니다'
    ).toContain('line-height')
  })

  it('자간도 같습니다', async () => {
    ed = await mountEditor('<p>hello world</p>')
    await settle()

    selectAll(editable())
    await choose('Letter Spacing', '0.2')

    expect(editable().innerHTML).toContain('letter-spacing')
  })

  it('문단 스타일을 고르면 제목이 됩니다', async () => {
    ed = await mountEditor('<p>hello world</p>')
    await settle()

    selectAll(editable())
    await choose('Paragraph Style', '2')

    expect(editable().querySelector('h2')).not.toBeNull()
  })
})
