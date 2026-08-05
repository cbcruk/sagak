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
    bus.on(AutocompleteEvents.AUTOCOMPLETE_APPLY, 'after', (payload) => {
      if (payload) applied = payload
    })

    bus.emit(AutocompleteEvents.AUTOCOMPLETE_APPLY)
    await settle(4)

    expect(applied).toEqual({ word: 'apply' })
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
