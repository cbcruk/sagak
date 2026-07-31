import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  toggleListForBlocks,
  shiftIndentForBlocks,
} from '@/core/commands/list-format'

/**
 * 리스트·들여쓰기 엔진 테스트
 *
 * Why: execCommand 없이 리스트 트리를 조작하는 엔진의 정확성 검증
 * How: (입력 HTML + 대상 블록) → 출력 HTML 골든 단언. 코어는 전역 selection에
 *      접근하지 않으므로 블록을 직접 넘겨 테스트한다
 */
describe('list-format engine', () => {
  let element: HTMLDivElement

  const blocks = (selector: string): HTMLElement[] =>
    Array.from(element.querySelectorAll<HTMLElement>(selector))

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

  describe('리스트 토글 — 생성', () => {
    it('문단을 리스트로 변환해야 함', () => {
      element.innerHTML = '<p>Hello</p>'

      expect(toggleListForBlocks(blocks('p'), 'ol')).toBe(true)
      expect(element.innerHTML).toBe('<ol><li>Hello</li></ol>')
    })

    it('연속된 문단을 하나의 리스트로 묶어야 함', () => {
      element.innerHTML = '<p>A</p><p>B</p><p>C</p>'

      expect(toggleListForBlocks(blocks('p'), 'ul')).toBe(true)
      expect(element.querySelectorAll('ul')).toHaveLength(1)
      expect(element.querySelectorAll('li')).toHaveLength(3)
      expect(element.innerHTML).toBe('<ul><li>A</li><li>B</li><li>C</li></ul>')
    })

    it('인라인 서식을 보존해야 함', () => {
      element.innerHTML = '<p>a <strong>b</strong></p>'

      toggleListForBlocks(blocks('p'), 'ol')
      expect(element.querySelector('li')?.innerHTML).toBe(
        'a <strong>b</strong>'
      )
    })

    it('인접한 동일 종류 리스트와 병합해야 함(정규형)', () => {
      element.innerHTML = '<ol><li>A</li></ol><p>B</p>'

      toggleListForBlocks(blocks('p'), 'ol')
      expect(element.querySelectorAll('ol')).toHaveLength(1)
      expect(element.innerHTML).toBe('<ol><li>A</li><li>B</li></ol>')
    })

    it('제목도 리스트 항목으로 변환해야 함', () => {
      element.innerHTML = '<h2>Title</h2>'

      expect(toggleListForBlocks(blocks('h2'), 'ul')).toBe(true)
      expect(element.innerHTML).toBe('<ul><li>Title</li></ul>')
    })
  })

  describe('리스트 토글 — 해제·종류 변경', () => {
    it('같은 종류면 리스트를 해제해야 함', () => {
      element.innerHTML = '<ol><li>Hello</li></ol>'

      expect(toggleListForBlocks(blocks('li'), 'ol')).toBe(true)
      expect(element.querySelector('ol')).toBeNull()
      expect(element.innerHTML).toBe('<p>Hello</p>')
    })

    it('다른 종류면 리스트 종류를 바꿔야 함', () => {
      element.innerHTML = '<ol><li>A</li><li>B</li></ol>'

      expect(toggleListForBlocks(blocks('li'), 'ul')).toBe(true)
      expect(element.querySelector('ol')).toBeNull()
      expect(element.innerHTML).toBe('<ul><li>A</li><li>B</li></ul>')
    })

    it('중간 항목 해제 시 리스트를 분할해야 함', () => {
      element.innerHTML = '<ul><li>A</li><li>B</li><li>C</li></ul>'
      const middle = [element.querySelectorAll('li')[1] as HTMLElement]

      expect(toggleListForBlocks(middle, 'ul')).toBe(true)
      expect(element.querySelectorAll('ul')).toHaveLength(2)
      expect(element.textContent).toBe('ABC')
      expect(element.querySelector('p')?.textContent).toBe('B')
    })

    it('전체 해제 시 빈 리스트를 제거해야 함', () => {
      element.innerHTML = '<ul><li>A</li><li>B</li></ul>'

      toggleListForBlocks(blocks('li'), 'ul')
      expect(element.querySelector('ul')).toBeNull()
      expect(element.querySelectorAll('p')).toHaveLength(2)
    })
  })

  describe('리스트 토글 — 위임', () => {
    it('빈 블록 목록은 null을 반환해야 함', () => {
      expect(toggleListForBlocks([], 'ol')).toBeNull()
    })

    it('리스트 항목과 일반 블록이 섞이면 null을 반환해야 함', () => {
      element.innerHTML = '<ul><li>A</li></ul><p>B</p>'
      const mixed = [
        element.querySelector('li') as HTMLElement,
        element.querySelector('p') as HTMLElement,
      ]

      expect(toggleListForBlocks(mixed, 'ol')).toBeNull()
      // 아무 것도 바뀌지 않아야 함
      expect(element.innerHTML).toBe('<ul><li>A</li></ul><p>B</p>')
    })

    it('중첩 블록을 담은 요소는 null을 반환해야 함', () => {
      element.innerHTML = '<div><p>inner</p></div>'
      const outer = [element.querySelector('div') as HTMLElement]

      expect(toggleListForBlocks(outer, 'ol')).toBeNull()
    })
  })

  describe('들여쓰기 — 리스트 항목', () => {
    it('두 번째 항목을 중첩 리스트로 들여써야 함', () => {
      element.innerHTML = '<ul><li>A</li><li>B</li></ul>'
      const second = [element.querySelectorAll('li')[1] as HTMLElement]

      expect(shiftIndentForBlocks(second, 1)).toBe(true)
      expect(element.innerHTML).toBe(
        '<ul><li>A<ul><li>B</li></ul></li></ul>'
      )
    })

    it('첫 항목은 들여쓸 수 없어 null을 반환해야 함', () => {
      element.innerHTML = '<ul><li>A</li><li>B</li></ul>'
      const first = [element.querySelector('li') as HTMLElement]

      expect(shiftIndentForBlocks(first, 1)).toBeNull()
      expect(element.innerHTML).toBe('<ul><li>A</li><li>B</li></ul>')
    })

    it('기존 중첩 리스트에 이어 붙여야 함', () => {
      element.innerHTML =
        '<ul><li>A<ul><li>B</li></ul></li><li>C</li></ul>'
      const outer = element.querySelectorAll(':scope > ul > li')
      const third = [outer[1] as HTMLElement]

      expect(shiftIndentForBlocks(third, 1)).toBe(true)
      expect(element.querySelectorAll('ul')).toHaveLength(2)
      expect(element.innerHTML).toBe(
        '<ul><li>A<ul><li>B</li><li>C</li></ul></li></ul>'
      )
    })

    it('중첩 항목을 내어쓰면 부모 뒤로 이동해야 함', () => {
      element.innerHTML = '<ul><li>A<ul><li>B</li></ul></li></ul>'
      const nested = [element.querySelector('ul ul li') as HTMLElement]

      expect(shiftIndentForBlocks(nested, -1)).toBe(true)
      expect(element.innerHTML).toBe('<ul><li>A</li><li>B</li></ul>')
    })

    it('최상위 항목을 내어쓰면 리스트에서 빠져야 함', () => {
      element.innerHTML = '<ul><li>A</li></ul>'
      const item = [element.querySelector('li') as HTMLElement]

      expect(shiftIndentForBlocks(item, -1)).toBe(true)
      expect(element.querySelector('ul')).toBeNull()
      expect(element.innerHTML).toBe('<p>A</p>')
    })
  })

  describe('들여쓰기 — 일반 블록', () => {
    it('문단에 margin-left를 적용해야 함', () => {
      element.innerHTML = '<p>Hello</p>'

      expect(shiftIndentForBlocks(blocks('p'), 1)).toBe(true)
      expect((element.querySelector('p') as HTMLElement).style.marginLeft).toBe(
        '40px'
      )
    })

    it('반복 들여쓰기는 누적되어야 함', () => {
      element.innerHTML = '<p>Hello</p>'

      shiftIndentForBlocks(blocks('p'), 1)
      shiftIndentForBlocks(blocks('p'), 1)
      expect((element.querySelector('p') as HTMLElement).style.marginLeft).toBe(
        '80px'
      )
    })

    it('내어쓰기로 0이 되면 스타일을 제거해야 함', () => {
      element.innerHTML = '<p style="margin-left: 40px">Hello</p>'

      expect(shiftIndentForBlocks(blocks('p'), -1)).toBe(true)
      expect((element.querySelector('p') as HTMLElement).style.marginLeft).toBe(
        ''
      )
    })

    it('들여쓰기가 없는 블록의 내어쓰기는 null을 반환해야 함', () => {
      element.innerHTML = '<p>Hello</p>'

      expect(shiftIndentForBlocks(blocks('p'), -1)).toBeNull()
    })

    it('여러 블록을 함께 들여써야 함', () => {
      element.innerHTML = '<p>A</p><p>B</p>'

      expect(shiftIndentForBlocks(blocks('p'), 1)).toBe(true)
      for (const p of blocks('p')) {
        expect(p.style.marginLeft).toBe('40px')
      }
    })
  })

  describe('코어 순수성', () => {
    it('전역 selection에 접근하지 않아야 함', () => {
      element.innerHTML = '<p>Hello</p>'
      const spy = vi.spyOn(window, 'getSelection')

      toggleListForBlocks(blocks('p'), 'ol')
      shiftIndentForBlocks(blocks('li'), 1)

      expect(spy).not.toHaveBeenCalled()
    })
  })
})
