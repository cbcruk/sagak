import { describe, it, expect, afterEach } from 'vitest'
import { AutocompleteEvents } from 'sagak-core'
import {
  mountEditor,
  settle,
  placeCaretInText,
  type MountedEditor,
} from './harness'

/**
 * `useEditorEvent` 로 옮긴 구독 4개를 지킵니다.
 *
 * 이전에는 `useEffect` 하나가 넷을 구독하고 해제까지 손으로 챙겼습니다.
 * 옮기면서 조용히 깨질 수 있는 부분이라 여기서 고정합니다.
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

  const show = async (bus: MountedEditor['context']['eventBus']) => {
    bus.emit(AutocompleteEvents.AUTOCOMPLETE_SHOW, {
      suggestions: ['apple', 'apply', 'apricot'],
      prefix: 'ap',
      position: { x: 10, y: 20 },
    })
    await settle(4)
  }

  it('SHOW 로 열리고 제안을 렌더해야 함', async () => {
    ed = await mountEditor('<p>안녕</p>')
    placeCaretInText(ed.editable, 1)
    await settle(4)

    expect(popover()).toBeNull()
    await show(ed.context.eventBus)

    expect(popover()).not.toBeNull()
    expect(popover()!.querySelectorAll('li')).toHaveLength(3)
    expect(selectedIndex()).toBe(0)
  })

  it('SELECT 로 앞뒤를 돌아야 함', async () => {
    ed = await mountEditor('<p>안녕</p>')
    placeCaretInText(ed.editable, 1)
    await settle(4)
    const bus = ed.context.eventBus
    await show(bus)

    bus.emit(AutocompleteEvents.AUTOCOMPLETE_SELECT, { direction: 'next' })
    await settle(4)
    expect(selectedIndex()).toBe(1)

    bus.emit(AutocompleteEvents.AUTOCOMPLETE_SELECT, { direction: 'prev' })
    await settle(4)
    expect(selectedIndex()).toBe(0)

    // 첫 항목에서 prev 는 끝으로 돌아야 합니다
    bus.emit(AutocompleteEvents.AUTOCOMPLETE_SELECT, { direction: 'prev' })
    await settle(4)
    expect(selectedIndex()).toBe(2)
  })

  it('페이로드 없는 APPLY 는 고른 단어를 실어 다시 발행해야 함', async () => {
    ed = await mountEditor('<p>안녕</p>')
    placeCaretInText(ed.editable, 1)
    await settle(4)
    const bus = ed.context.eventBus
    await show(bus)

    bus.emit(AutocompleteEvents.AUTOCOMPLETE_SELECT, { direction: 'next' })
    await settle(4)

    let applied: unknown = null
    bus.on(AutocompleteEvents.AUTOCOMPLETE_APPLY, (payload) => {
      if (payload) applied = payload
    })

    bus.emit(AutocompleteEvents.AUTOCOMPLETE_APPLY)
    await settle(4)

    expect(applied).toEqual({ word: 'apply' })
  })

  /**
   * ## 대조군에서 안 물던 것 — 마우스로 고른 단어
   *
   * Svelte 로 옮기며 "페이로드가 있으면 흘려보낸다" 는 가드를 지웠는데
   * 179개가 전부 통과했습니다. 그 가드는 **우리가 보낸 것을 우리가 다시
   * 받는 것**을 막습니다.
   *
   * 없으면 마우스로 고른 순간 확정이 두 번 나갑니다 — 누른 단어 한 번,
   * 그리고 곧바로 **지금 강조된 단어**로 한 번 더. 둘이 다르면 누른 것이
   * 아닌 단어가 들어갑니다.
   *
   * 있던 검사는 키보드 갈래(페이로드 없는 APPLY)만 봤습니다. 강조와 다른
   * 항목을 눌러서 그 차이가 드러나게 합니다.
   */
  it('마우스로 고르면 강조된 것이 아니라 누른 단어가 나가야 함', async () => {
    ed = await mountEditor('<p>안녕</p>')
    placeCaretInText(ed.editable, 1)
    await settle(4)
    const bus = ed.context.eventBus
    await show(bus)

    /* 강조를 두 번째(`apply`) 로 옮겨 두고 세 번째(`apricot`) 를 누릅니다 */
    bus.emit(AutocompleteEvents.AUTOCOMPLETE_SELECT, { direction: 'next' })
    await settle(4)
    expect(selectedIndex()).toBe(1)

    const applied: unknown[] = []
    bus.on(AutocompleteEvents.AUTOCOMPLETE_APPLY, (payload) => {
      if (payload) applied.push(payload)
    })

    const items = [...popover()!.querySelectorAll('li')]
    items[2].dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    await settle(6)

    expect(applied, '누른 단어 말고 다른 것이 더 나갔습니다').toEqual([
      { word: 'apricot' },
    ])
  })

  it('HIDE 로 닫혀야 함', async () => {
    ed = await mountEditor('<p>안녕</p>')
    placeCaretInText(ed.editable, 1)
    await settle(4)
    const bus = ed.context.eventBus
    await show(bus)
    expect(popover()).not.toBeNull()

    bus.emit(AutocompleteEvents.AUTOCOMPLETE_HIDE)
    await settle(4)
    expect(popover()).toBeNull()
  })
})
