import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { toggleFormatInRange } from '@/core/commands/inline-format'
import {
  applyInlineStyleInRange,
  applyLinkInRange,
  removeLinkInRange,
} from '@/core/commands/inline-style'

/**
 * 인라인 엔진 코어 순수성 테스트
 *
 * Why: functional core / imperative shell 원칙 — 코어는 전역 selection에
 *      접근하지 않고 주어진 Range만으로 동작해야 함
 * How: 전역 selection을 비운 채 Range만 만들어 호출하고, getSelection이
 *      호출되지 않았음과 DOM 결과가 올바름을 함께 단언
 */
describe('inline engine cores (functional core)', () => {
  let element: HTMLDivElement
  let getSelectionSpy: ReturnType<typeof vi.spyOn>

  const rangeOver = (
    startNode: Node,
    startOffset: number,
    endNode: Node,
    endOffset: number
  ): Range => {
    const range = document.createRange()
    range.setStart(startNode, startOffset)
    range.setEnd(endNode, endOffset)
    return range
  }

  const textOf = (selector: string): Text =>
    element.querySelector(selector)!.firstChild as Text

  beforeEach(() => {
    // 전역 선택을 비워, 코어가 이를 의존하면 실패하도록 만듭니다
    window.getSelection()?.removeAllRanges()

    element = document.createElement('div')
    element.contentEditable = 'true'
    document.body.appendChild(element)

    getSelectionSpy = vi.spyOn(window, 'getSelection')
  })

  afterEach(() => {
    document.body.removeChild(element)
    vi.restoreAllMocks()
  })

  it('toggleFormatInRange는 전역 selection 없이 서식을 적용해야 함', () => {
    element.innerHTML = '<p>Hello World</p>'
    const text = textOf('p')
    const range = rangeOver(text, 6, text, 11)

    const nodes = toggleFormatInRange(range, 'bold')

    expect(nodes).not.toBeNull()
    expect(element.innerHTML).toBe('<p>Hello <strong>World</strong></p>')
    expect(getSelectionSpy).not.toHaveBeenCalled()
  })

  it('toggleFormatInRange는 영향받은 텍스트 노드를 반환해야 함', () => {
    element.innerHTML = '<p>Hello</p>'
    const text = textOf('p')

    const nodes = toggleFormatInRange(rangeOver(text, 0, text, 5), 'italic')

    expect(nodes).toHaveLength(1)
    expect(nodes![0].data).toBe('Hello')
    expect(nodes![0].parentElement?.tagName).toBe('EM')
  })

  it('toggleFormatInRange는 collapsed 범위에 null을 반환해야 함', () => {
    element.innerHTML = '<p>Hello</p>'
    const text = textOf('p')

    expect(toggleFormatInRange(rangeOver(text, 2, text, 2), 'bold')).toBeNull()
    expect(element.querySelector('strong')).toBeNull()
    expect(getSelectionSpy).not.toHaveBeenCalled()
  })

  it('applyInlineStyleInRange는 전역 selection 없이 스타일을 적용해야 함', () => {
    element.innerHTML = '<p>Hello</p>'
    const text = textOf('p')

    const nodes = applyInlineStyleInRange(
      rangeOver(text, 0, text, 5),
      'color',
      'red'
    )

    expect(nodes).not.toBeNull()
    expect((element.querySelector('span') as HTMLElement).style.color).toBe(
      'red'
    )
    expect(getSelectionSpy).not.toHaveBeenCalled()
  })

  it('applyLinkInRange는 전역 selection 없이 링크를 만들어야 함', () => {
    element.innerHTML = '<p>Hello</p>'
    const text = textOf('p')

    const nodes = applyLinkInRange(
      rangeOver(text, 0, text, 5),
      'https://example.com'
    )

    expect(nodes).not.toBeNull()
    expect(element.querySelector('a')?.getAttribute('href')).toBe(
      'https://example.com'
    )
    expect(getSelectionSpy).not.toHaveBeenCalled()
  })

  it('removeLinkInRange는 전역 selection 없이 링크를 해제해야 함', () => {
    element.innerHTML = '<p><a href="https://example.com">Hello</a></p>'
    const text = textOf('a')

    const nodes = removeLinkInRange(rangeOver(text, 0, text, 5))

    expect(nodes).not.toBeNull()
    expect(element.querySelector('a')).toBeNull()
    expect(element.querySelector('p')?.textContent).toBe('Hello')
    expect(getSelectionSpy).not.toHaveBeenCalled()
  })

  it('코어는 선택 영역을 변경하지 않아야 함 (셸의 책임)', () => {
    element.innerHTML = '<p>Hello</p>'
    const text = textOf('p')

    toggleFormatInRange(rangeOver(text, 0, text, 5), 'bold')

    // 전역 선택은 비어 있던 그대로여야 함
    getSelectionSpy.mockRestore()
    expect(window.getSelection()?.rangeCount ?? 0).toBe(0)
  })
})
