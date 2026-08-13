import { describe, it, expect, afterEach, beforeEach } from 'vitest'
import {
  mountEditor,
  selectAll,
  settle,
  button,
  click,
  type MountedEditor,
} from './harness'

/**
 * 색 고르개의 **특성 테스트** — 옮기기 전에 지금 동작을 못 박아 둡니다.
 *
 * ## 왜 옮기기 전에 쓰는가
 *
 * 이 컴포넌트에는 테스트가 **하나도 없었습니다.** 툴바에 두 개나 그려지는데
 * 열림·색 적용·최근 색상 어느 것도 검사가 없습니다.
 *
 * nanotags 이주의 관문은 "ui 테스트 개수가 그대로인가" 인데, 검사가 없는
 * 컴포넌트에서는 **그 관문이 눈이 멉니다.** 옮기고 나서 다 통과해도 아무것도
 * 증명하지 못합니다.
 *
 * 그래서 순서를 바꿉니다 — 지금 판에 대고 먼저 쓰고, 통과하는 것을 본 뒤에
 * 옮깁니다. 그래야 옮긴 뒤의 통과가 뜻을 갖습니다.
 *
 * ## 무엇을 못 박는가
 *
 * 구현이 아니라 **사용자가 보는 것**입니다 — 어떤 상태 훅을 쓰는지, 팝오버를
 * 어떤 태그로 그리는지는 옮기면서 바뀌어도 됩니다.
 */

let ed: MountedEditor | null = null

const RECENT_TEXT_KEY = 'sagak-editor-recent-text-colors'
const RECENT_BG_KEY = 'sagak-editor-recent-bg-colors'

beforeEach(() => {
  localStorage.removeItem(RECENT_TEXT_KEY)
  localStorage.removeItem(RECENT_BG_KEY)
})

afterEach(() => {
  ed?.unmount()
  ed = null
})

const textButton = (): HTMLElement => button(ed!.root, 'Text Color')
const bgButton = (): HTMLElement => button(ed!.root, 'Highlight Color')

/** 색 견본은 `title` 이 색 값입니다 */
function swatches(root: HTMLElement, color: string): HTMLButtonElement[] {
  return [...root.querySelectorAll<HTMLButtonElement>(`button[title="${color}"]`)]
}

/** 팝오버가 열려 있는지 — 견본이 보이면 열린 것입니다 */
function isOpen(root: HTMLElement): boolean {
  return swatches(root, '#ff0000').length > 0
}

describe('색 고르개', () => {
  it('버튼을 누르면 열리고 다시 누르면 닫힙니다', async () => {
    ed = await mountEditor('<p>hello</p>')
    await settle()

    expect(isOpen(ed.root), '처음부터 열려 있습니다').toBe(false)

    await click(textButton())
    expect(isOpen(ed.root), '눌렀는데 안 열립니다').toBe(true)

    await click(textButton())
    expect(isOpen(ed.root), '다시 눌렀는데 안 닫힙니다').toBe(false)
  })

  it('바깥을 누르면 닫힙니다', async () => {
    ed = await mountEditor('<p>hello</p>')
    await settle()

    await click(textButton())
    expect(isOpen(ed.root)).toBe(true)

    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    await settle()

    expect(isOpen(ed.root), '바깥을 눌렀는데 안 닫힙니다').toBe(false)
  })

  it('고른 색이 글에 적용됩니다', async () => {
    ed = await mountEditor('<p>hello world</p>')
    await settle()

    selectAll(ed.editable)
    await click(textButton())
    await click(swatches(ed.root, '#ff0000')[0])

    expect(ed.editable.innerHTML, '색이 안 먹었습니다').toMatch(
      /color|ff0000|255, 0, 0/i
    )
  })

  it('고르고 나면 닫힙니다', async () => {
    ed = await mountEditor('<p>hello world</p>')
    await settle()

    selectAll(ed.editable)
    await click(textButton())
    await click(swatches(ed.root, '#ff0000')[0])

    expect(isOpen(ed.root), '고른 뒤에도 열려 있습니다').toBe(false)
  })

  /**
   * 최근 색상은 **다음에 열었을 때도 남아야** 합니다 — 저장소에 씁니다.
   * 이 저장소 키는 사용자 데이터라 이름을 바꾸면 기존 것이 유실됩니다
   * (`app-or-library.md` §11 에 같은 이유가 적혀 있습니다).
   */
  it('고른 색이 최근 목록으로 저장됩니다', async () => {
    ed = await mountEditor('<p>hello world</p>')
    await settle()

    selectAll(ed.editable)
    await click(textButton())
    await click(swatches(ed.root, '#ff0000')[0])

    const stored = localStorage.getItem(RECENT_TEXT_KEY)
    expect(stored, '최근 색상이 저장되지 않았습니다').not.toBeNull()
    expect(JSON.parse(stored as string)).toContain('#ff0000')
  })

  it('저장된 최근 색상이 다시 열 때 보입니다', async () => {
    localStorage.setItem(RECENT_TEXT_KEY, JSON.stringify(['#4a86e8']))

    ed = await mountEditor('<p>hello</p>')
    await settle()
    await click(textButton())

    /*
     * 프리셋에도 같은 색이 있으므로 **개수**로 봅니다 — 최근 목록에 하나 더
     * 있으면 둘입니다.
     */
    expect(
      swatches(ed.root, '#4a86e8').length,
      '최근 목록이 안 보입니다'
    ).toBeGreaterThan(1)
  })

  /** 글자색과 형광펜은 저장소가 따로입니다 */
  it('글자색과 형광펜의 최근 목록이 섞이지 않습니다', async () => {
    ed = await mountEditor('<p>hello world</p>')
    await settle()

    selectAll(ed.editable)
    await click(textButton())
    await click(swatches(ed.root, '#ff0000')[0])

    expect(localStorage.getItem(RECENT_BG_KEY), '형광펜 쪽에도 들어갔습니다').toBeNull()
  })

  /** 형광펜에만 지우기가 있습니다 — 글자색은 "없음" 이 성립하지 않습니다 */
  it('형광펜에만 지우기가 있습니다', async () => {
    ed = await mountEditor('<p>hello</p>')
    await settle()

    await click(bgButton())
    const remove = [...ed.root.querySelectorAll('button')].filter((b) =>
      b.textContent?.includes('Remove Highlight')
    )
    expect(remove.length, '형광펜에 지우기가 없습니다').toBe(1)

    await click(bgButton())
    await click(textButton())
    const removeInText = [...ed.root.querySelectorAll('button')].filter((b) =>
      b.textContent?.includes('Remove Highlight')
    )
    expect(removeInText.length, '글자색에 지우기가 있습니다').toBe(0)
  })
})
