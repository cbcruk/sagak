import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { autocomplete, createAutocompletePlugin } from '@/features/autocomplete'
import type { AutocompleteState } from '@/features/autocomplete'
import { mountPluginArea } from '../helpers/plugin-area'
import type { PluginArea } from '../helpers/plugin-area'

/**
 * 자동 완성 — **고른 번호가 어디에 있는가.**
 *
 * 예전에는 팝오버가 들고 있었습니다. 그래서 키보드로 확정할 때 코어가 "지금
 * 고른 것이 무엇이냐" 를 물으러 가야 했고, 그 왕복이 `AUTOCOMPLETE_APPLY`
 * **한 이름을 양쪽 방향으로** 쓰는 모양이 됐습니다 — 코어가 빈 채로 쏘면
 * 팝오버가 단어를 실어 되쏘는 식입니다. 자기가 보낸 것을 자기가 다시 받는
 * 것을 막는 가드가 딸려 있었고, 그 가드를 지우면 마우스로 고른 순간 확정이
 * 두 번 나갔습니다.
 *
 * 목록의 주인이 코어이므로 번호의 주인도 코어입니다. 아래는 그 뒤로 무엇이
 * 성립하는지입니다.
 */
describe('자동 완성', () => {
  let ed: PluginArea
  let element: HTMLElement

  beforeEach(async () => {
    ed = mountPluginArea()
    element = ed.element
    await ed.pluginManager.register(createAutocompletePlugin())
  })

  afterEach(() => {
    ed.destroy()
  })

  const module = () => autocomplete(ed.context)

  /** 지금 상태 — 구독은 곧바로 한 번 줍니다 */
  const state = (): AutocompleteState | null => {
    let seen: AutocompleteState | null = null
    module().subscribe((next) => {
      seen = next
    })()

    return seen
  }

  /** 캐럿을 문서 끝에 두고 제안이 뜰 때까지 */
  const type = async (html: string): Promise<void> => {
    ed.load(html)
    ed.collapse(ed.area.getStateHandle().getState()!.doc.content.size - 1)

    element.dispatchEvent(
      new KeyboardEvent('keyup', { key: 'x', bubbles: true })
    )
    await new Promise((resolve) => setTimeout(resolve, 250))
  }

  const key = (name: string): boolean =>
    !element.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: name,
        bubbles: true,
        cancelable: true,
      })
    )

  it('제안이 뜨면 첫 항목이 골라져 있어야 함', async () => {
    await type('<p>apple apply apricot ap</p>')

    expect(state()).toMatchObject({
      suggestions: ['apple', 'apply', 'apricot'],
      prefix: 'ap',
      index: 0,
    })
  })

  it('구독하면 지금 값을 곧바로 줘야 함', async () => {
    await type('<p>apple apply ap</p>')

    let first: AutocompleteState | null | undefined
    const unsub = module().subscribe((next) => {
      first ??= next
    })
    unsub()

    expect(first).not.toBeNull()
    expect(first!.suggestions).toEqual(['apple', 'apply'])
  })

  describe('고르기', () => {
    beforeEach(async () => {
      await type('<p>apple apply apricot ap</p>')
    })

    it('위아래로 옮기면 끝에서 돌아야 함', () => {
      module().move(1)
      expect(state()!.index).toBe(1)

      module().move(1)
      expect(state()!.index).toBe(2)

      module().move(1)
      expect(state()!.index).toBe(0)

      module().move(-1)
      expect(state()!.index).toBe(2)
    })

    /**
     * 화살표는 **팝오버가 아니라 코어가** 받습니다. 캐럿이 같이 움직이면
     * 안 되므로 PM 에게 "먹었다" 고 답해야 합니다.
     */
    it('화살표 키가 목록을 옮기고 캐럿까지 가지 않아야 함', () => {
      expect(key('ArrowDown')).toBe(true)
      expect(state()!.index).toBe(1)

      expect(key('ArrowUp')).toBe(true)
      expect(state()!.index).toBe(0)
    })

    it('마우스가 지나간 항목이 골라져야 함', () => {
      module().highlight(2)
      expect(state()!.index).toBe(2)

      /* 목록 밖은 무시합니다 */
      module().highlight(9)
      expect(state()!.index).toBe(2)
    })
  })

  describe('넣기', () => {
    beforeEach(async () => {
      await type('<p>apple apply apricot ap</p>')
    })

    /**
     * 여기가 왕복이 있던 자리입니다 — 팝오버에 묻지 않고 곧바로 넣습니다.
     */
    it('Enter 로 고른 것이 들어가고 닫혀야 함', () => {
      module().move(1)

      expect(key('Enter')).toBe(true)

      expect(element.textContent).toBe('apple apply apricot apply')
      expect(state()).toBeNull()
    })

    it('Tab 도 같아야 함', () => {
      expect(key('Tab')).toBe(true)
      expect(element.textContent).toBe('apple apply apricot apple')
    })

    /**
     * 옛 가드가 지키던 것입니다. 강조된 것과 **다른 항목**을 눌렀을 때
     * 누른 것이 들어가야 합니다 — 예전에는 확정이 두 번 나가면서 누르지
     * 않은 단어가 뒤이어 들어갈 수 있었습니다.
     */
    it('번호를 주면 강조된 것이 아니라 그것이 들어가야 함', () => {
      module().move(1)
      expect(state()!.index).toBe(1)

      expect(module().apply(2)).toBe(true)

      expect(element.textContent).toBe('apple apply apricot apricot')
      expect(state()).toBeNull()
    })

    it('안 떠 있으면 넣을 것이 없어야 함', () => {
      module().dismiss()

      expect(module().apply()).toBe(false)
    })
  })

  describe('닫기', () => {
    beforeEach(async () => {
      await type('<p>apple apply ap</p>')
    })

    it('Escape 로 닫혀야 함', () => {
      expect(key('Escape')).toBe(true)
      expect(state()).toBeNull()
    })

    /**
     * 안 떠 있을 때의 키는 **우리 것이 아닙니다.** 자동 완성이 앞줄에 서게
     * 됐으므로(`WysiwygArea.reconfigure`) 안 맞는 키를 흘려보내는 것은 이제
     * 이쪽 책임입니다 — 먹어 버리면 Escape 로 다이얼로그가 안 닫히고 Enter 로
     * 줄바꿈이 안 됩니다.
     */
    it('안 떠 있으면 키를 안 먹어야 함', () => {
      module().dismiss()

      expect(key('Escape')).toBe(false)
      expect(key('ArrowDown')).toBe(false)

      /* Enter 는 `baseKeymap` 이 받아 문단을 나눕니다 — 우리가 아닙니다 */
      const before = ed.area.getStateHandle().getState()!.doc.childCount
      key('Enter')
      expect(ed.area.getStateHandle().getState()!.doc.childCount).toBe(
        before + 1
      )
    })

    it('닫힌 뒤 또 닫아도 조용해야 함', () => {
      module().dismiss()

      let calls = 0
      const unsub = module().subscribe(() => {
        calls += 1
      })
      module().dismiss()
      unsub()

      /* 구독할 때 한 번 준 것뿐이어야 합니다 */
      expect(calls).toBe(1)
    })
  })

  it('같은 에디터에서는 같은 객체여야 함', () => {
    expect(autocomplete(ed.context)).toBe(module())
  })
})
