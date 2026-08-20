import { describe, it, expect, afterEach } from 'vitest'
import { autocomplete } from 'sagak-core'
import type { Autocomplete } from 'sagak-core'
import {
  mountEditor,
  settle,
  placeCaretInText,
  type MountedEditor,
} from './harness'

/**
 * 팝오버는 이제 **그리기만 합니다.**
 *
 * 예전에는 이벤트 넷을 구독하고 "몇 번째가 강조되어 있는가" 를 직접 들고
 * 있었습니다. 그래서 여기 검사도 넷을 하나씩 쏘아 보는 모양이었습니다.
 *
 * 번호의 주인이 코어로 갔으니 여기서 지킬 것은 하나입니다 — **코어가 준 것을
 * 그대로 그리는가.** 무엇을 제안할지 정하는 일은 코어 쪽 검사가 봅니다.
 */
describe('자동 완성 팝오버', () => {
  let ed: MountedEditor | null = null

  afterEach(() => {
    ed?.unmount()
    ed = null
  })

  const popover = (): HTMLElement | null =>
    document.querySelector('[data-scope="autocomplete"][data-part="popover"]')

  const selectedIndex = (): number =>
    [...(popover()?.querySelectorAll('li') ?? [])].findIndex((li) =>
      li.hasAttribute('data-selected')
    )

  /**
   * 코어가 제안을 띄운 상태를 만듭니다.
   *
   * 예전에는 `AUTOCOMPLETE_SHOW` 를 쏘면 됐지만, 지금 상태의 주인은 코어라
   * **진짜로 치게 합니다** — 검사가 재는 대상이 한 겹 가까워집니다.
   */
  const open = async (): Promise<Autocomplete> => {
    ed = await mountEditor('<p>apple apply apricot ap</p>')
    const module = autocomplete(ed.context)

    placeCaretInText(ed.editable, 22)
    ed.editable.dispatchEvent(
      new KeyboardEvent('keyup', { key: 'p', bubbles: true })
    )
    await new Promise((resolve) => setTimeout(resolve, 250))
    await settle(4)

    return module
  }

  it('코어가 띄우면 제안을 그려야 함', async () => {
    const module = await open()

    expect(popover()).not.toBeNull()
    expect(popover()!.querySelectorAll('li')).toHaveLength(3)
    expect(selectedIndex()).toBe(0)

    module.dismiss()
    await settle(4)
    expect(popover()).toBeNull()
  })

  it('고른 번호가 바뀌면 강조가 따라가야 함', async () => {
    const module = await open()

    module.move(1)
    await settle(4)
    expect(selectedIndex()).toBe(1)

    module.move(-1)
    await settle(4)
    expect(selectedIndex()).toBe(0)

    // 첫 항목에서 뒤로는 끝으로 돌아야 합니다
    module.move(-1)
    await settle(4)
    expect(selectedIndex()).toBe(2)
  })

  it('마우스가 지나가면 그 항목이 강조돼야 함', async () => {
    await open()

    const items = [...popover()!.querySelectorAll('li')]
    items[2].dispatchEvent(new MouseEvent('mouseenter', { bubbles: false }))
    await settle(4)

    expect(selectedIndex()).toBe(2)
  })

  /**
   * ## 예전에 여기서 무너지던 것
   *
   * 확정이 **왕복**이라, 마우스로 고르면 확정이 두 번 나갔습니다 — 누른 단어
   * 한 번, 그리고 곧바로 **지금 강조된 단어**로 한 번 더. 둘이 다르면 누른 것이
   * 아닌 단어가 들어갔고, 그것을 막으려고 "페이로드가 있으면 흘려보낸다" 는
   * 가드가 있었습니다.
   *
   * 번호의 주인이 코어가 되면서 왕복도 가드도 없어졌습니다. 강조와 **다른**
   * 항목을 눌러 그것을 확인합니다.
   */
  it('강조된 것이 아니라 누른 단어가 들어가야 함', async () => {
    const module = await open()

    module.move(1)
    await settle(4)
    expect(selectedIndex()).toBe(1)

    const items = [...popover()!.querySelectorAll('li')]
    items[2].dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    await settle(6)

    expect(ed!.editable.textContent).toBe('apple apply apricot apricot')
    expect(popover()).toBeNull()
  })
})
