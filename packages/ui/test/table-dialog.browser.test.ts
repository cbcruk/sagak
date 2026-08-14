import { describe, it, expect, afterEach } from 'vitest'
import {
  mountEditor,
  settle,
  placeCaret,
  placeCaretInText,
  click,
  button,
  dialog,
  isOpen,
  openDialogCount,
  type MountedEditor,
} from './harness'

/**
 * 표 다이얼로그는 `useDialogHandle` 의 `restoreThen` 을 가장 많이 씁니다
 * (여덟 곳). 손으로 복사돼 있던 "닫고 → 다음 프레임에 선택 영역 복원 → 발행"
 * 을 훅으로 모으면서, 그 순서가 실제로 지켜지는지 여기서 잡습니다.
 *
 * 훅에서 `restoreSelection()` 을 빼고 돌려 확인했습니다. 실패하는 것은 **삽입**
 * 뿐입니다 — 캐럿이 문단 안에 있었으므로 복원이 없으면 표가 어디에도 안 들어
 * 갑니다. 반대로 행 추가/표 삭제는 복원 없이도 통과합니다. 캐럿이 이미 셀 안에
 * 있었고 다이얼로그가 닫히면서 그대로 남기 때문입니다. 즉 이 둘이 지키는 것은
 * 복원이 아니라 "닫고 나서 발행한다" 는 순서입니다.
 */
describe('표 다이얼로그', () => {
  let ed: MountedEditor | null = null

  afterEach(() => {
    ed?.unmount()
    ed = null
  })

  it('표를 만들고 닫아야 함', async () => {
    ed = await mountEditor('<p>table here</p>')
    placeCaretInText(ed.editable, 5)
    await settle()

    await click(button(ed.root, 'Insert Table'))
    // 라벨이 Insert → Edit 로 바뀌므로 이름 대신 개수로 셉니다
    expect(openDialogCount()).toBe(1)

    const dlg = dialog('Insert Table')
    const insert = [...dlg.querySelectorAll('button')].find(
      (b) => b.textContent?.trim() === 'Insert'
    )!
    await click(insert)
    await settle(6)

    expect(openDialogCount()).toBe(0)

    const table = ed.editable.querySelector('table')
    expect(table).not.toBeNull()
    expect(table!.rows.length).toBe(3)
    expect(table!.rows[0].cells.length).toBe(3)
  })

  it('표 안에 캐럿이 있으면 편집 모드로 열리고, 행을 더할 수 있어야 함', async () => {
    ed = await mountEditor(
      '<table><tbody>' +
        '<tr><td>a</td><td>b</td></tr>' +
        '<tr><td>c</td><td>d</td></tr>' +
        '</tbody></table>'
    )
    const firstCell = ed.editable.querySelector('td')!
    placeCaret(firstCell.firstChild!, 0)
    await settle()

    await click(button(ed.root, 'Insert Table'))
    const dlg = dialog('Edit Table')
    expect(isOpen(dlg)).toBe(true)

    const below = [...dlg.querySelectorAll('button')].find(
      (b) => b.textContent?.trim() === '+ Below'
    )!
    // 여기서 rAF 를 기다리지 않으면 복원 전에 확인하게 됩니다
    await click(below)
    await settle(6)

    expect(openDialogCount()).toBe(0)
    expect(ed.editable.querySelector('table')!.rows.length).toBe(3)
  })

  it('표를 지워야 함', async () => {
    ed = await mountEditor(
      '<table><tbody><tr><td>x</td></tr></tbody></table><p>after</p>'
    )
    const cell = ed.editable.querySelector('td')!
    placeCaret(cell.firstChild!, 0)
    await settle()

    await click(button(ed.root, 'Insert Table'))
    const dlg = dialog('Edit Table')

    const remove = [...dlg.querySelectorAll('button')].find(
      (b) => b.textContent?.trim() === 'Delete Table'
    )!
    await click(remove)
    await settle(6)

    expect(openDialogCount()).toBe(0)
    expect(ed.editable.querySelector('table')).toBeNull()
  })
})
