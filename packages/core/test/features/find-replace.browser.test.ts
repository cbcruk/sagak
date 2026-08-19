import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { EventBus } from '@/core/event-bus'
import { trackComposition } from '@/core/composition'
import type { CompositionTracker } from '@/core/composition'
import { findReplace } from '@/features/find-replace'
import type { FindReplace } from '@/features/find-replace'
import { WysiwygArea } from '@/editor/editing-area/modes/wysiwyg-area'
import type { EditorContext, EditingAreaManager } from '@/core/types'

/**
 * 찾기/바꾸기 — **객체 하나**입니다.
 *
 * 예전에는 플러그인이었고, 검사는 이벤트 여섯을 쏘고 답을 `STYLE_CHANGED` 의
 * `style === 'find'` 에서 받아 봤습니다. 그래서 "찾으면 몇 개인가" 를 확인하는
 * 데 스파이·페이로드 모양 맞추기·`vi.restoreAllMocks()` 가 매번 필요했습니다.
 *
 * 지금은 부른 자리에서 그대로 돌아옵니다 — 검사가 짧아진 만큼이 그대로
 * 부르는 쪽에서 없어진 일입니다.
 *
 * 찾기가 문서 모델 위에서 돈다는 것은 그대로입니다: 강조는 **데코레이션**이라
 * 화면에는 `.find-highlight` 로 보이지만 문서에는 없고, 바꾸기는
 * 트랜잭션입니다.
 */
describe('찾기/바꾸기', () => {
  let eventBus: EventBus
  let composition: CompositionTracker
  let container: HTMLDivElement
  let area: WysiwygArea
  let element: HTMLElement
  let context: EditorContext
  let find: FindReplace

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)

    eventBus = new EventBus()
    area = new WysiwygArea({ container, eventBus })
    area.setRawContent('<p>Hello World. Hello everyone. This is a test.</p>')
    element = area.getElement()
    composition = trackComposition(element)

    context = {
      eventBus,
      composition,
      config: { element },
      editingAreaManager: {
        getCurrentArea: () => area,
      } as unknown as EditingAreaManager,
    }
    find = findReplace(context)
  })

  afterEach(() => {
    area.destroy()
    document.body.removeChild(container)
  })

  const highlights = (): NodeListOf<HTMLElement> =>
    element.querySelectorAll<HTMLElement>('.find-highlight')

  /**
   * 에디터 하나에 하나여야 합니다 — 일치 목록이 그 에디터의 상태이므로,
   * 부를 때마다 새로 만들면 다이얼로그가 잡은 것과 단축키가 잡은 것이
   * 서로 다른 자리를 가리킵니다.
   */
  it('같은 에디터에서는 같은 객체여야 함', () => {
    expect(findReplace(context)).toBe(find)
  })

  describe('찾기', () => {
    it('찾은 개수와 현재 번호를 돌려주고 강조해야 함', () => {
      expect(find.find('Hello')).toEqual({ matches: 2, index: 0 })
      expect(highlights()).toHaveLength(2)
    })

    it('기본은 대소문자를 안 가려야 함', () => {
      expect(find.find('hello')).toEqual({ matches: 2, index: 0 })
    })

    it('가리라고 하면 가려야 함', () => {
      expect(find.find('hello', { caseSensitive: true })).toEqual({
        matches: 0,
        index: -1,
      })
    })

    it('단어 단위로 찾아야 함', () => {
      area.setRawContent('<p>Hello Helloworld world</p>')

      expect(find.find('Hello', { wholeWord: true })).toEqual({
        matches: 1,
        index: 0,
      })
    })

    /**
     * 빈 질의는 **오류가 아니라 지우기**입니다. 다이얼로그에서 글자를 다 지운
     * 상태가 그것이고, 그때 남아 있던 강조는 사라지는 것이 맞습니다.
     * 예전에는 `false` 를 돌려주고 경고를 찍으면서 강조는 남겨 뒀습니다.
     */
    it('빈 질의는 지우기와 같아야 함', () => {
      find.find('Hello')
      expect(highlights()).toHaveLength(2)

      expect(find.find('   ')).toEqual({ matches: 0, index: -1 })
      expect(highlights()).toHaveLength(0)
    })

    it('없으면 0개여야 함', () => {
      expect(find.find('nonexistent')).toEqual({ matches: 0, index: -1 })
      expect(highlights()).toHaveLength(0)
    })
  })

  describe('이동', () => {
    beforeEach(() => {
      area.setRawContent('<p>test test test</p>')
      find.find('test')
    })

    /**
     * 강조는 **데코레이션**이라 다시 칠할 때마다 새 요소가 그려집니다.
     * 예전 span 은 제자리에서 색만 바뀌었지만 이제는 매번 다시 물어야 합니다.
     */
    const colors = (): string[] =>
      [...highlights()].map((el) => el.style.backgroundColor)

    it('다음으로 가면 현재 항목이 옮겨가야 함', () => {
      const before = colors()
      expect(before).toHaveLength(3)
      expect(before[0]).not.toBe(before[1])

      expect(find.next()).toEqual({ matches: 3, index: 1 })

      const after = colors()
      expect(after[1]).toBe(before[0])
      expect(after[0]).toBe(before[1])
    })

    it('끝에서 다음은 처음으로 돌아야 함', () => {
      expect(find.next().index).toBe(1)
      expect(find.next().index).toBe(2)
      expect(find.next().index).toBe(0)
    })

    it('처음에서 이전은 끝으로 돌아야 함', () => {
      expect(find.previous()).toEqual({ matches: 3, index: 2 })
    })

    it('찾은 것이 없으면 이동해도 그대로여야 함', () => {
      find.clear()

      expect(find.next()).toEqual({ matches: 0, index: -1 })
    })
  })

  describe('바꾸기', () => {
    beforeEach(() => {
      area.setRawContent('<p>Hello World. Hello everyone.</p>')
      find.find('Hello')
    })

    /**
     * 무엇을 바꿀지는 **지금 어디에 있는가**로 정해집니다. 예전에는 질의를
     * 다시 넘겨야 했는데, 넘긴 질의와 찾을 때 쓴 질의가 다르면 어떻게 되는지
     * 아무도 정하지 않은 채였습니다.
     */
    it('현재 항목을 바꾸고 남은 개수를 돌려줘야 함', () => {
      expect(find.replace('Hi')).toEqual({ matches: 1, index: 0 })
      expect(element.textContent).toContain('Hi World')
    })

    /**
     * 바꿔 넣은 글이 질의를 품고 있으면(`a` → `aa`) 다시 찾는 방식은 방금
     * 만든 것을 새 일치로 잡아 끝나지 않습니다. 남은 자리를 옮기기만 합니다.
     */
    it('바꾼 글이 질의를 품어도 늘어나지 않아야 함', () => {
      area.setRawContent('<p>a a</p>')
      expect(find.find('a')).toEqual({ matches: 2, index: 0 })

      expect(find.replace('aa').matches).toBe(1)
      expect(element.textContent).toBe('aa a')

      expect(find.replace('aa').matches).toBe(0)
      expect(element.textContent).toBe('aa aa')
    })

    it('현재 항목이 없으면 아무것도 안 바꿔야 함', () => {
      find.clear()

      expect(find.replace('Hi')).toEqual({ matches: 0, index: -1 })
      expect(element.textContent).toContain('Hello World')
    })
  })

  describe('모두 바꾸기', () => {
    beforeEach(() => {
      area.setRawContent('<p>Hello World. Hello everyone. Hello!</p>')
    })

    it('전부 바꾸고 바꾼 개수를 돌려줘야 함', () => {
      expect(find.replaceAll('Hello', 'Hi')).toEqual({
        matches: 0,
        index: -1,
        replaced: 3,
      })

      expect(element.textContent).not.toContain('Hello')
      expect(element.textContent).toBe('Hi World. Hi everyone. Hi!')
    })

    it('대소문자를 가려야 함', () => {
      area.setRawContent('<p>Hello hello HELLO</p>')

      expect(find.replaceAll('hello', 'hi', { caseSensitive: true }).replaced)
        .toBe(1)
      expect(element.textContent).toBe('Hello hi HELLO')
    })

    it('단어 단위로 바꿔야 함', () => {
      area.setRawContent('<p>Hello Helloworld</p>')

      expect(find.replaceAll('Hello', 'Hi', { wholeWord: true }).replaced).toBe(
        1
      )
      expect(element.textContent).toBe('Hi Helloworld')
    })

    it('없으면 0개여야 함', () => {
      expect(find.replaceAll('nonexistent', 'something')).toEqual({
        matches: 0,
        index: -1,
        replaced: 0,
      })
    })

    it('빈 질의는 지우기와 같아야 함', () => {
      find.find('Hello')

      expect(find.replaceAll('', 'Hi')).toEqual({ matches: 0, index: -1 })
      expect(element.textContent).toContain('Hello')
      expect(highlights()).toHaveLength(0)
    })
  })

  describe('지우기', () => {
    beforeEach(() => {
      area.setRawContent('<p>Hello World. Hello everyone.</p>')
      find.find('Hello')
    })

    it('강조를 걷고 글은 그대로여야 함', () => {
      expect(highlights()).toHaveLength(2)

      expect(find.clear()).toEqual({ matches: 0, index: -1 })

      expect(highlights()).toHaveLength(0)
      expect(element.textContent).toBe('Hello World. Hello everyone.')
    })
  })

  describe('조합 중', () => {
    /**
     * **찾기는 문서를 안 바꿉니다.**
     *
     * 조합 가드는 문서를 고치는 길에 있습니다 (`runModelCommand`). 찾기는 읽고
     * 화면에 칠할 뿐이라 지나가지 않습니다 — 예전에는 플러그인이 제 손으로
     * 가드를 걸어 이것까지 막고 있었습니다.
     */
    it('찾기는 조합 중에도 돼야 함', () => {
      element.dispatchEvent(new CompositionEvent('compositionstart'))

      expect(find.find('Hello')).toEqual({ matches: 2, index: 0 })

      element.dispatchEvent(new CompositionEvent('compositionend'))
    })

    it('바꾸기는 조합 중에 막혀야 함', () => {
      find.find('Hello')

      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      element.dispatchEvent(new CompositionEvent('compositionstart'))

      /* 상태도 글도 그대로여야 합니다 */
      expect(find.replace('Hi')).toEqual({ matches: 2, index: 0 })
      /* 막혔으므로 `replaced` 가 없습니다 — 0 개를 바꾼 것과 다릅니다 */
      expect(find.replaceAll('Hello', 'Hi').replaced).toBeUndefined()
      expect(element.textContent).toContain('Hello World')

      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('IME composition in progress')
      )

      warn.mockRestore()
      element.dispatchEvent(new CompositionEvent('compositionend'))
    })

    it('조합이 끝나면 다시 돼야 함', () => {
      element.dispatchEvent(new CompositionEvent('compositionstart'))
      element.dispatchEvent(new CompositionEvent('compositionend'))
      expect(composition.isComposing()).toBe(false)

      find.find('Hello')
      expect(find.replace('Hi').matches).toBe(1)
    })
  })

  describe('실제 시나리오', () => {
    it('찾고 · 옮기고 · 바꾸는 흐름', () => {
      area.setRawContent('<p>foo bar foo bar</p>')

      expect(find.find('foo').matches).toBe(2)
      expect(highlights()).toHaveLength(2)

      find.next()
      find.clear()

      expect(find.replaceAll('foo', 'baz').replaced).toBe(2)
      expect(element.textContent).toBe('baz bar baz bar')

      expect(find.find('bar').matches).toBe(2)
      expect(find.replaceAll('bar', 'qux').replaced).toBe(2)
      expect(element.textContent).toBe('baz qux baz qux')
    })

    it('정규식 특수문자가 그대로 글자여야 함', () => {
      area.setRawContent('<p>Price: $100. Discount: 50%. Total: $50.</p>')

      expect(find.find('$')).toEqual({ matches: 2, index: 0 })

      find.replaceAll('$', 'USD ')
      expect(element.textContent).toContain('USD 100')
      expect(element.textContent).toContain('USD 50')
    })
  })
})
