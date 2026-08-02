import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { MockInstance } from 'vitest'
import {
  CommandRegistry,
  type CommandContext,
} from '@/core/command-registry'
import {
  registerDefaultCommands,
  createDefaultCommandRegistry,
} from '@/core/default-commands'
import { EditorCore } from '@/core/editor-core'
import { EventBus } from '@/core/event-bus'
import { clearPendingFormats } from '@/core/commands/stored-marks'

/**
 * legacyFallback 옵션 테스트
 *
 * Why: deprecated된 execCommand를 전혀 호출하지 않는 구성을 선택할 수 있어야 함
 * How: 판단 불가 상황(선택 없음)에서 execCommand 호출 여부를 스파이로 확인
 */
describe('legacyFallback 옵션', () => {
  let element: HTMLDivElement
  let execSpy: MockInstance<
    (commandId: string, showUI?: boolean, value?: string) => boolean
  >
  let stateSpy: MockInstance<(commandId: string) => boolean>

  beforeEach(() => {
    window.getSelection()?.removeAllRanges()
    clearPendingFormats()

    element = document.createElement('div')
    element.contentEditable = 'true'
    element.innerHTML = '<p>Hello</p>'
    document.body.appendChild(element)

    execSpy = vi.spyOn(document, 'execCommand').mockReturnValue(true)
    stateSpy = vi.spyOn(document, 'queryCommandState').mockReturnValue(true)
  })

  afterEach(() => {
    document.body.removeChild(element)
    clearPendingFormats()
    vi.restoreAllMocks()
  })

  const newRegistry = (legacyFallback?: boolean): CommandRegistry => {
    const ctx: CommandContext = { eventBus: new EventBus() }
    const registry = new CommandRegistry(ctx)
    registerDefaultCommands(registry, { legacyFallback })
    return registry
  }

  describe('기본값 (안전망 유지)', () => {
    it('판단 불가 시 execCommand로 위임해야 함', () => {
      const registry = newRegistry()

      // 선택이 없어 네이티브가 판단할 수 없는 상황
      expect(registry.run('bold')).toBe(true)
      expect(execSpy).toHaveBeenCalledWith('bold', false)
    })

    it('상태 조회도 위임해야 함', () => {
      const registry = newRegistry()

      expect(registry.queryState('bold')).toBe(true)
      expect(stateSpy).toHaveBeenCalledWith('bold')
    })
  })

  describe('legacyFallback: false', () => {
    it('판단 불가 시에도 execCommand를 호출하지 않아야 함', () => {
      const registry = newRegistry(false)

      expect(registry.run('bold')).toBe(false)
      expect(execSpy).not.toHaveBeenCalled()
    })

    it('상태 조회도 queryCommandState를 호출하지 않아야 함', () => {
      const registry = newRegistry(false)

      expect(registry.queryState('bold')).toBe(false)
      expect(stateSpy).not.toHaveBeenCalled()
    })

    it('모든 서식 커맨드에서 execCommand가 호출되지 않아야 함', () => {
      const registry = newRegistry(false)

      const commands = [
        'bold',
        'italic',
        'underline',
        'strikeThrough',
        'subscript',
        'superscript',
        'foreColor',
        'backColor',
        'fontName',
        'fontSize',
        'formatBlock',
        'insertOrderedList',
        'insertUnorderedList',
        'indent',
        'outdent',
        'justifyLeft',
        'justifyCenter',
        'justifyRight',
        'justifyFull',
        'createLink',
        'unlink',
      ]

      for (const command of commands) {
        registry.run(command, 'x')
      }

      expect(execSpy).not.toHaveBeenCalled()
    })

    it('실제 선택이 있으면 네이티브 구현은 그대로 동작해야 함', () => {
      const registry = newRegistry(false)

      const text = element.querySelector('p')!.firstChild as Text
      const range = document.createRange()
      range.setStart(text, 0)
      range.setEnd(text, 5)
      const selection = window.getSelection()!
      selection.removeAllRanges()
      selection.addRange(range)

      expect(registry.run('bold')).toBe(true)
      expect(element.querySelector('strong')?.textContent).toBe('Hello')
      expect(execSpy).not.toHaveBeenCalled()
    })
  })

  describe('createDefaultCommandRegistry / EditorCore 연동', () => {
    it('createDefaultCommandRegistry가 옵션을 전달해야 함', () => {
      const ctx: CommandContext = { eventBus: new EventBus() }
      const registry = createDefaultCommandRegistry(ctx, {
        legacyFallback: false,
      })

      registry.run('bold')
      expect(execSpy).not.toHaveBeenCalled()
    })

    it('EditorCore 설정으로 폴백을 끌 수 있어야 함', () => {
      const core = new EditorCore({ element, legacyFallback: false })

      core.getCommandRegistry().run('bold')
      expect(execSpy).not.toHaveBeenCalled()

      core.destroy()
    })

    it('EditorCore 기본값은 폴백을 유지해야 함', () => {
      const core = new EditorCore({ element })

      core.getCommandRegistry().run('bold')
      expect(execSpy).toHaveBeenCalled()

      core.destroy()
    })
  })
})
