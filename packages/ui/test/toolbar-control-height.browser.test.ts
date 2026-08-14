import { describe, it, expect, afterEach } from 'vitest'
import { mountEditor, settle } from './harness'
import type { MountedEditor } from './harness'

/**
 * 툴바의 버튼과 셀렉트는 **같은 높이**여야 합니다.
 *
 * 안 맞춰 두면 셀렉트가 브라우저 기본값을 씁니다 — 재 보면 버튼 26px 옆에
 * 셀렉트가 **40px** 로 서 있었습니다. 나란히 놓인 컨트롤끼리 14px 차이입니다.
 *
 * 값을 각자 적어 두면 한쪽만 고쳐져 다시 벌어지므로 `--sagak-control-height`
 * 하나를 둘이 같이 봅니다. 이 테스트는 그 토큰이 실제로 양쪽에 닿는지 봅니다.
 */

let ed: MountedEditor | null = null

afterEach(() => {
  ed?.unmount()
  ed = null
})

/** 툴바에 실제로 보이는 것만 — 숨겨진 메뉴 안의 버튼은 높이가 0 입니다 */
function visible(root: HTMLElement, selector: string): HTMLElement[] {
  return [
    ...root.querySelectorAll<HTMLElement>(`[data-scope="toolbar"] ${selector}`),
  ].filter((el) => el.getBoundingClientRect().height > 0)
}

const heightsOf = (elements: HTMLElement[]): number[] =>
  elements.map((el) => el.getBoundingClientRect().height)

describe('툴바 컨트롤 높이', () => {
  it('셀렉트가 아이콘 버튼과 같은 높이입니다', async () => {
    ed = await mountEditor()
    await settle(5)

    const buttons = visible(ed.root, '[data-part="icon-button"]')
    const selects = visible(ed.root, 'select')

    expect(buttons.length, '아이콘 버튼을 못 찾았습니다').toBeGreaterThan(0)
    expect(selects.length, '셀렉트를 못 찾았습니다').toBeGreaterThan(0)

    const buttonHeights = [...new Set(heightsOf(buttons))]
    expect(buttonHeights, '버튼끼리도 높이가 다릅니다').toHaveLength(1)

    const selectHeights = [...new Set(heightsOf(selects))]
    expect(
      selectHeights,
      `셀렉트 높이가 제각각입니다: ${selectHeights.join(', ')}`
    ).toHaveLength(1)

    expect(
      selectHeights[0],
      `셀렉트 ${selectHeights[0]}px 와 버튼 ${buttonHeights[0]}px 가 다릅니다`
    ).toBe(buttonHeights[0])
  })

  it('토큰 하나에서 옵니다 — 값을 각자 적어 두지 않았습니다', async () => {
    ed = await mountEditor()
    await settle(5)

    const token = getComputedStyle(ed.root).getPropertyValue(
      '--sagak-control-height'
    )
    expect(token.trim(), '--sagak-control-height 토큰이 없습니다').not.toBe('')

    const expected = Number.parseFloat(token)
    for (const el of [
      ...visible(ed.root, '[data-part="icon-button"]'),
      ...visible(ed.root, 'select'),
    ]) {
      expect(
        el.getBoundingClientRect().height,
        `${el.tagName} 이 토큰(${expected}px)을 안 따릅니다`
      ).toBe(expected)
    }
  })

  /**
   * 셀렉트 폭을 못 박아 둡니다.
   *
   * 툴바는 `flex-wrap` 이라 폭이 조금만 달라져도 줄바꿈 경계를 넘을 수
   * 있습니다. 실제로 `padding` 을 건드렸을 때 폭 합이 **442 → 298px** 로 줄었고,
   * 자동 저장 표시가 `saved` 가 되는 순간 편집 영역이 102 → 126px 로
   * 내려갔습니다.
   *
   * 글자 크기를 14 → 12px 로 줄인 지금은 합 **420px** 입니다. 줄어들긴 했지만
   * 경계를 넘지는 않습니다. 이 숫자가 흔들리면 여기서 먼저 걸립니다.
   */
  it('셀렉트 폭이 예상대로입니다 — 줄바꿈 경계의 앞잡이', async () => {
    ed = await mountEditor()
    await settle(5)

    const widths = visible(ed.root, 'select').map((el) =>
      Math.round(el.getBoundingClientRect().width)
    )

    expect(widths).toEqual([101, 104, 60, 70, 85])
  })
})
