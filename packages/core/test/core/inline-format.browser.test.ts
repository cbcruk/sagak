import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { toggleInlineFormat } from '@/core/commands/inline-format'
import {
  CommandRegistry,
  type CommandContext,
} from '@/core/command-registry'
import { registerNativeInlineToggles } from '@/core/commands/native-inline-toggles'
import { registerLegacyExecCommands } from '@/core/legacy-exec-command'
import { EventBus } from '@/core/event-bus'

/**
 * 인라인 서식 엔진 테스트
 *
 * Why: execCommand 없이 인라인 토글을 구현하는 엔진의 정확성 검증
 * How: (입력 HTML + 선택) → 출력 HTML 골든 단언. 경계 분할·부분 선택·
 *      중첩 해제·인접 병합·별칭 태그·배타 서식을 확인
 */
describe('inline-format engine', () => {
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

  describe('적용 (wrap)', () => {
    it('전체 선택에 정규 태그를 적용해야 함', () => {
      element.innerHTML = '<p>Hello</p>'
      const text = textOf('p')
      select(text, 0, text, 5)

      expect(toggleInlineFormat('bold')).toBe(true)
      expect(element.innerHTML).toBe('<p><strong>Hello</strong></p>')
    })

    it('부분 선택은 경계를 분할해 해당 구간만 감싸야 함', () => {
      element.innerHTML = '<p>Hello World</p>'
      const text = textOf('p')
      select(text, 6, text, 11)

      expect(toggleInlineFormat('italic')).toBe(true)
      expect(element.innerHTML).toBe('<p>Hello <em>World</em></p>')
    })

    it('여러 텍스트 노드에 걸친 선택을 처리해야 함', () => {
      element.innerHTML = '<p>Hello <em>World</em> end</p>'
      const p = element.querySelector('p')!
      const first = p.firstChild as Text // 'Hello '
      const last = p.lastChild as Text // ' end'
      select(first, 0, last, 4)

      expect(toggleInlineFormat('bold')).toBe(true)
      // em은 유지되고, 모든 구간이 strong으로 감싸져야 함
      expect(element.querySelectorAll('strong')).toHaveLength(3)
      expect(element.querySelector('em')?.textContent).toBe('World')
    })

    it('일부만 서식일 때 미서식 구간에 적용해야 함(통일)', () => {
      element.innerHTML = '<p><strong>Hello</strong> World</p>'
      const strongText = textOf('strong')
      const tail = element.querySelector('p')!.lastChild as Text
      select(strongText, 0, tail, 6)

      expect(toggleInlineFormat('bold')).toBe(true)
      expect(element.querySelector('p')!.textContent).toBe('Hello World')
      // 전체가 굵게 — strong 바깥에 노출된 텍스트가 없어야 함
      for (const node of element.querySelector('p')!.childNodes) {
        if (node.nodeType === Node.TEXT_NODE) {
          expect((node as Text).data.trim()).toBe('')
        }
      }
    })

    it('인접한 동일 서식 요소와 병합해야 함(정규형)', () => {
      element.innerHTML = '<p><strong>He</strong>llo</p>'
      const tail = element.querySelector('p')!.lastChild as Text
      select(tail, 0, tail, 3)

      expect(toggleInlineFormat('bold')).toBe(true)
      expect(element.querySelectorAll('strong')).toHaveLength(1)
      expect(element.querySelector('strong')?.textContent).toBe('Hello')
    })
  })

  describe('해제 (unwrap)', () => {
    it('전체 서식 선택을 해제해야 함', () => {
      element.innerHTML = '<p><strong>Hello</strong></p>'
      const text = textOf('strong')
      select(text, 0, text, 5)

      expect(toggleInlineFormat('bold')).toBe(true)
      expect(element.innerHTML).toBe('<p>Hello</p>')
    })

    it('부분 해제는 서식 요소를 분할해야 함', () => {
      element.innerHTML = '<p><strong>Hello</strong></p>'
      const text = textOf('strong')
      select(text, 1, text, 4)

      expect(toggleInlineFormat('bold')).toBe(true)
      expect(element.innerHTML).toBe(
        '<p><strong>H</strong>ell<strong>o</strong></p>'
      )
    })

    it('중간 래퍼(다른 서식)를 보존하며 해제해야 함', () => {
      element.innerHTML = '<p><strong><em>Hello</em></strong></p>'
      const text = textOf('em')
      select(text, 0, text, 5)

      expect(toggleInlineFormat('bold')).toBe(true)
      expect(element.querySelector('strong')).toBeNull()
      expect(element.querySelector('em')?.textContent).toBe('Hello')
    })

    it('별칭 태그(b)도 해제해야 함', () => {
      element.innerHTML = '<p><b>Hello</b></p>'
      const text = textOf('b')
      select(text, 0, text, 5)

      expect(toggleInlineFormat('bold')).toBe(true)
      expect(element.querySelector('b')).toBeNull()
      expect(element.querySelector('strong')).toBeNull()
      expect(element.querySelector('p')?.textContent).toBe('Hello')
    })

    it('중첩된 동일 서식(strong 안의 b)을 모두 해제해야 함', () => {
      element.innerHTML = '<p><strong><b>Hello</b></strong></p>'
      const text = textOf('b')
      select(text, 0, text, 5)

      expect(toggleInlineFormat('bold')).toBe(true)
      expect(element.querySelector('strong')).toBeNull()
      expect(element.querySelector('b')).toBeNull()
    })
  })

  describe('배타 서식 (sub ↔ sup)', () => {
    it('superscript 적용 시 subscript를 해제해야 함', () => {
      element.innerHTML = '<p><sub>x</sub></p>'
      const text = textOf('sub')
      select(text, 0, text, 1)

      expect(toggleInlineFormat('superscript')).toBe(true)
      expect(element.querySelector('sub')).toBeNull()
      expect(element.querySelector('sup')?.textContent).toBe('x')
    })
  })

  describe('선택 복원', () => {
    it('토글 후 선택 영역이 유지되어야 함', () => {
      element.innerHTML = '<p>Hello World</p>'
      const text = textOf('p')
      select(text, 6, text, 11)

      toggleInlineFormat('bold')

      const selection = window.getSelection()!
      expect(selection.toString()).toBe('World')
    })
  })

  describe('레거시 위임', () => {
    let registry: CommandRegistry

    beforeEach(() => {
      const ctx: CommandContext = { eventBus: new EventBus() }
      registry = new CommandRegistry(ctx)
      registerNativeInlineToggles(registry)
      registerLegacyExecCommands(registry)
    })

    it('collapsed 커서는 레거시로 위임해야 함(타이핑 상태)', () => {
      element.innerHTML = '<p>Hello</p>'
      const text = textOf('p')
      select(text, 2, text, 2)

      const execSpy = vi.spyOn(document, 'execCommand').mockReturnValue(true)

      expect(registry.run('bold')).toBe(true)
      expect(execSpy).toHaveBeenCalledWith('bold', false)
      expect(element.querySelector('strong')).toBeNull()
    })

    it('선택 영역이 없으면 레거시로 위임해야 함', () => {
      window.getSelection()?.removeAllRanges()
      const execSpy = vi.spyOn(document, 'execCommand').mockReturnValue(false)

      expect(registry.run('italic')).toBe(false)
      expect(execSpy).toHaveBeenCalled()
    })

    it('편집 영역 밖 선택은 레거시로 위임해야 함', () => {
      const outside = document.createElement('p')
      outside.textContent = 'outside'
      document.body.appendChild(outside)
      select(outside.firstChild!, 0, outside.firstChild!, 3)

      const execSpy = vi.spyOn(document, 'execCommand').mockReturnValue(true)

      expect(registry.run('bold')).toBe(true)
      expect(execSpy).toHaveBeenCalled()
      expect(outside.querySelector('strong')).toBeNull()

      document.body.removeChild(outside)
    })
  })
})
