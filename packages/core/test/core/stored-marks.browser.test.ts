import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  togglePendingFormat,
  getPendingFormat,
  clearPendingFormats,
  hasPendingFormats,
  insertTextWithPendingFormats,
  installStoredMarks,
} from '@/core/commands/stored-marks'
import {
  CommandRegistry,
  type CommandContext,
} from '@/core/command-registry'
import { registerNativeInlineToggles } from '@/core/commands/native-inline-toggles'
import { registerNativeQueries } from '@/core/commands/native-query'
import { EventBus } from '@/core/event-bus'

/**
 * 보류 서식(stored marks) 테스트
 *
 * Why: execCommand가 브라우저 내부에 들고 있던 "다음 입력에 적용할 서식"
 *      상태를 에디터가 직접 소유하는지 검증
 * How: collapsed 커서에서 토글 → 입력 → 결과 마크업을 확인
 */
describe('stored marks', () => {
  let element: HTMLDivElement
  let registry: CommandRegistry

  const putCursor = (node: Node, offset: number) => {
    const range = document.createRange()
    range.setStart(node, offset)
    range.collapse(true)
    const selection = window.getSelection()!
    selection.removeAllRanges()
    selection.addRange(range)
  }

  const selectRange = (node: Node, start: number, end: number) => {
    const range = document.createRange()
    range.setStart(node, start)
    range.setEnd(node, end)
    const selection = window.getSelection()!
    selection.removeAllRanges()
    selection.addRange(range)
  }

  beforeEach(() => {
    window.getSelection()?.removeAllRanges()
    clearPendingFormats()

    element = document.createElement('div')
    element.contentEditable = 'true'
    document.body.appendChild(element)

    const ctx: CommandContext = { eventBus: new EventBus() }
    registry = new CommandRegistry(ctx)
    registerNativeInlineToggles(registry)
    registerNativeQueries(registry)
  })

  afterEach(() => {
    clearPendingFormats()
    document.body.removeChild(element)
    vi.restoreAllMocks()
  })

  describe('보류 상태 기록', () => {
    it('collapsed 커서에서 서식을 보류해야 함', () => {
      element.innerHTML = '<p>Hello</p>'
      putCursor(element.querySelector('p')!.firstChild!, 2)

      expect(togglePendingFormat('bold')).toBe(true)
      expect(getPendingFormat('bold')).toBe(true)
      expect(hasPendingFormats()).toBe(true)
    })

    it('다시 토글하면 보류가 해제되어야 함', () => {
      element.innerHTML = '<p>Hello</p>'
      putCursor(element.querySelector('p')!.firstChild!, 2)

      togglePendingFormat('bold')
      togglePendingFormat('bold')

      expect(getPendingFormat('bold')).toBeUndefined()
      expect(hasPendingFormats()).toBe(false)
    })

    it('서식 안에서 끄면 해제를 보류해야 함', () => {
      element.innerHTML = '<p><strong>Hello</strong></p>'
      putCursor(element.querySelector('strong')!.firstChild!, 2)

      expect(togglePendingFormat('bold')).toBe(true)
      expect(getPendingFormat('bold')).toBe(false)
    })

    it('커서가 이동하면 보류를 폐기해야 함', () => {
      element.innerHTML = '<p>Hello</p>'
      const text = element.querySelector('p')!.firstChild!
      putCursor(text, 2)
      togglePendingFormat('bold')

      putCursor(text, 4)
      expect(getPendingFormat('bold')).toBeUndefined()
      expect(hasPendingFormats()).toBe(false)
    })

    it('선택 영역(비 collapsed)에서는 기록하지 않아야 함', () => {
      element.innerHTML = '<p>Hello</p>'
      selectRange(element.querySelector('p')!.firstChild!, 0, 5)

      expect(togglePendingFormat('bold')).toBe(false)
    })
  })

  describe('입력 시 적용', () => {
    it('보류한 서식으로 텍스트를 감싸야 함', () => {
      element.innerHTML = '<p>ab</p>'
      putCursor(element.querySelector('p')!.firstChild!, 2)
      togglePendingFormat('bold')

      expect(insertTextWithPendingFormats('X')).toBe(true)
      expect(element.querySelector('strong')?.textContent).toBe('X')
      expect(element.querySelector('p')?.textContent).toBe('abX')
    })

    it('여러 서식을 함께 적용해야 함', () => {
      element.innerHTML = '<p>ab</p>'
      putCursor(element.querySelector('p')!.firstChild!, 2)
      togglePendingFormat('bold')
      togglePendingFormat('italic')

      insertTextWithPendingFormats('X')
      expect(element.querySelector('strong em, em strong')).not.toBeNull()
      expect(element.textContent).toBe('abX')
    })

    it('해제 보류는 서식 밖으로 빼내야 함', () => {
      element.innerHTML = '<p><strong>ab</strong></p>'
      putCursor(element.querySelector('strong')!.firstChild!, 2)
      togglePendingFormat('bold')

      expect(insertTextWithPendingFormats('X')).toBe(true)
      expect(element.textContent).toBe('abX')
      // X는 strong 밖에 있어야 함
      expect(element.querySelector('strong')?.textContent).toBe('ab')
    })

    it('적용 후 보류 상태를 소비해야 함', () => {
      element.innerHTML = '<p>ab</p>'
      putCursor(element.querySelector('p')!.firstChild!, 2)
      togglePendingFormat('bold')

      insertTextWithPendingFormats('X')
      expect(hasPendingFormats()).toBe(false)
    })

    it('보류가 없으면 처리하지 않아야 함', () => {
      element.innerHTML = '<p>ab</p>'
      putCursor(element.querySelector('p')!.firstChild!, 2)

      expect(insertTextWithPendingFormats('X')).toBe(false)
    })
  })

  describe('커맨드 · 상태 조회 연동', () => {
    it('collapsed 커서 토글을 커맨드가 처리해야 함(레거시 미위임)', () => {
      element.innerHTML = '<p>Hello</p>'
      putCursor(element.querySelector('p')!.firstChild!, 2)

      const execSpy = vi.spyOn(document, 'execCommand')

      expect(registry.run('bold')).toBe(true)
      expect(execSpy).not.toHaveBeenCalled()
      expect(hasPendingFormats()).toBe(true)
    })

    it('queryState가 보류 서식을 반영해야 함', () => {
      element.innerHTML = '<p>Hello</p>'
      putCursor(element.querySelector('p')!.firstChild!, 2)

      expect(registry.queryState('bold')).toBe(false)
      registry.run('bold')
      expect(registry.queryState('bold')).toBe(true)
    })

    it('서식 안에서 끄면 queryState가 false여야 함', () => {
      element.innerHTML = '<p><strong>Hello</strong></p>'
      putCursor(element.querySelector('strong')!.firstChild!, 2)

      expect(registry.queryState('bold')).toBe(true)
      registry.run('bold')
      expect(registry.queryState('bold')).toBe(false)
    })
  })

  describe('installStoredMarks (beforeinput 통합)', () => {
    it('입력을 가로채 보류 서식을 적용해야 함', () => {
      element.innerHTML = '<p>ab</p>'
      const cleanup = installStoredMarks(element)

      putCursor(element.querySelector('p')!.firstChild!, 2)
      togglePendingFormat('bold')

      const event = new InputEvent('beforeinput', {
        inputType: 'insertText',
        data: 'X',
        bubbles: true,
        cancelable: true,
      })
      element.dispatchEvent(event)

      expect(event.defaultPrevented).toBe(true)
      expect(element.querySelector('strong')?.textContent).toBe('X')

      cleanup()
    })

    it('보류가 없으면 기본 입력을 막지 않아야 함', () => {
      element.innerHTML = '<p>ab</p>'
      const cleanup = installStoredMarks(element)

      putCursor(element.querySelector('p')!.firstChild!, 2)

      const event = new InputEvent('beforeinput', {
        inputType: 'insertText',
        data: 'X',
        bubbles: true,
        cancelable: true,
      })
      element.dispatchEvent(event)

      expect(event.defaultPrevented).toBe(false)

      cleanup()
    })

    it('cleanup 후에는 가로채지 않아야 함', () => {
      element.innerHTML = '<p>ab</p>'
      const cleanup = installStoredMarks(element)

      putCursor(element.querySelector('p')!.firstChild!, 2)
      togglePendingFormat('bold')
      cleanup()

      const event = new InputEvent('beforeinput', {
        inputType: 'insertText',
        data: 'X',
        bubbles: true,
        cancelable: true,
      })
      element.dispatchEvent(event)

      expect(event.defaultPrevented).toBe(false)
    })
  })
})
