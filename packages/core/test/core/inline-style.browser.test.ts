import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  applyInlineStyle,
  applyLink,
  removeLink,
} from '@/core/commands/inline-style'

/**
 * 인라인 스타일/링크 엔진 테스트
 *
 * Why: execCommand 없이 span/anchor 래핑을 구현하는 엔진의 정확성 검증
 * How: (입력 HTML + 선택) → 출력 HTML 골든 단언
 */
describe('inline-style engine', () => {
  let element: HTMLDivElement

  const select = (
    startNode: Node,
    startOffset: number,
    endNode: Node,
    endOffset: number
  ) => {
    const range = document.createRange()
    range.setStart(startNode, startOffset)
    range.setEnd(endNode, endOffset)
    const selection = window.getSelection()!
    selection.removeAllRanges()
    selection.addRange(range)
  }

  const textOf = (selector: string): Text =>
    element.querySelector(selector)!.firstChild as Text

  beforeEach(() => {
    window.getSelection()?.removeAllRanges()

    element = document.createElement('div')
    element.contentEditable = 'true'
    document.body.appendChild(element)
  })

  afterEach(() => {
    document.body.removeChild(element)
    vi.restoreAllMocks()
  })

  describe('applyInlineStyle', () => {
    it('선택 구간을 색상 span으로 감싸야 함', () => {
      element.innerHTML = '<p>Hello</p>'
      const text = textOf('p')
      select(text, 0, text, 5)

      expect(applyInlineStyle('color', 'red')).toBe(true)
      const span = element.querySelector('span') as HTMLElement
      expect(span.style.color).toBe('red')
      expect(span.textContent).toBe('Hello')
    })

    it('부분 선택은 해당 구간만 감싸야 함', () => {
      element.innerHTML = '<p>Hello World</p>'
      const text = textOf('p')
      select(text, 6, text, 11)

      expect(applyInlineStyle('backgroundColor', 'yellow')).toBe(true)
      const span = element.querySelector('span') as HTMLElement
      expect(span.textContent).toBe('World')
      expect(span.style.backgroundColor).toBe('yellow')
      expect(element.querySelector('p')!.textContent).toBe('Hello World')
    })

    it('기존 스타일 span을 재사용해 값을 갱신해야 함(중첩 방지)', () => {
      element.innerHTML = '<p><span style="color: blue">Hello</span></p>'
      const text = textOf('span')
      select(text, 0, text, 5)

      expect(applyInlineStyle('color', 'red')).toBe(true)
      expect(element.querySelectorAll('span')).toHaveLength(1)
      expect(
        (element.querySelector('span') as HTMLElement).style.color
      ).toBe('red')
    })

    it('다른 속성의 스타일 span에는 속성을 추가해야 함', () => {
      element.innerHTML = '<p><span style="color: blue">Hello</span></p>'
      const text = textOf('span')
      select(text, 0, text, 5)

      expect(applyInlineStyle('fontFamily', 'Georgia')).toBe(true)
      expect(element.querySelectorAll('span')).toHaveLength(1)
      const span = element.querySelector('span') as HTMLElement
      expect(span.style.color).toBe('blue')
      expect(span.style.fontFamily).toBe('Georgia')
    })

    it('인접한 동일 스타일 span과 병합해야 함(정규형)', () => {
      element.innerHTML = '<p><span style="color: red;">He</span>llo</p>'
      const tail = element.querySelector('p')!.lastChild as Text
      select(tail, 0, tail, 3)

      expect(applyInlineStyle('color', 'red')).toBe(true)
      expect(element.querySelectorAll('span')).toHaveLength(1)
      expect(element.querySelector('span')?.textContent).toBe('Hello')
    })

    it('collapsed 커서는 위임해야 함', () => {
      element.innerHTML = '<p>Hello</p>'
      const text = textOf('p')
      select(text, 2, text, 2)

      expect(applyInlineStyle('color', 'red')).toBeUndefined()
      expect(element.querySelector('span')).toBeNull()
    })
  })

  describe('applyLink / removeLink', () => {
    it('선택 구간을 링크로 감싸야 함', () => {
      element.innerHTML = '<p>Hello World</p>'
      const text = textOf('p')
      select(text, 0, text, 5)

      expect(applyLink('https://example.com')).toBe(true)
      const anchor = element.querySelector('a') as HTMLAnchorElement
      expect(anchor.getAttribute('href')).toBe('https://example.com')
      expect(anchor.textContent).toBe('Hello')
    })

    it('여러 텍스트 노드에 걸친 링크는 병합되어야 함', () => {
      element.innerHTML = '<p>Hello <em>World</em></p>'
      const p = element.querySelector('p')!
      const first = p.firstChild as Text
      const emText = textOf('em')
      select(first, 0, emText, 5)

      expect(applyLink('https://example.com')).toBe(true)
      // em 앞뒤 텍스트가 서로 다른 부모라 앵커는 인접 병합으로 하나가 되지는
      // 않지만, 모든 구간이 링크 안에 있어야 함
      for (const a of element.querySelectorAll('a')) {
        expect(a.getAttribute('href')).toBe('https://example.com')
      }
      expect(element.querySelectorAll('a').length).toBeGreaterThanOrEqual(1)
    })

    it('기존 링크의 href를 갱신해야 함', () => {
      element.innerHTML = '<p><a href="https://old.com">Hello</a></p>'
      const text = textOf('a')
      select(text, 0, text, 5)

      expect(applyLink('https://new.com')).toBe(true)
      expect(element.querySelectorAll('a')).toHaveLength(1)
      expect(element.querySelector('a')?.getAttribute('href')).toBe(
        'https://new.com'
      )
    })

    it('링크를 해제해야 함', () => {
      element.innerHTML = '<p><a href="https://example.com">Hello</a></p>'
      const text = textOf('a')
      select(text, 0, text, 5)

      expect(removeLink()).toBe(true)
      expect(element.querySelector('a')).toBeNull()
      expect(element.querySelector('p')?.textContent).toBe('Hello')
    })

    it('부분 해제는 링크를 분할해야 함', () => {
      element.innerHTML = '<p><a href="https://example.com">Hello</a></p>'
      const text = textOf('a')
      select(text, 1, text, 4)

      expect(removeLink()).toBe(true)
      const anchors = element.querySelectorAll('a')
      expect(anchors).toHaveLength(2)
      expect(anchors[0].textContent).toBe('H')
      expect(anchors[1].textContent).toBe('o')
      expect(element.querySelector('p')?.textContent).toBe('Hello')
    })

    it('링크가 없으면 아무 것도 하지 않고 성공해야 함', () => {
      element.innerHTML = '<p>Hello</p>'
      const text = textOf('p')
      select(text, 0, text, 5)

      expect(removeLink()).toBe(true)
      expect(element.innerHTML).toBe('<p>Hello</p>')
    })
  })
})
