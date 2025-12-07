import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { EventBus } from '../../core/src/event-bus'
import { PluginManager } from '../../core/src/plugin-manager'
import { SelectionManager } from '../../core/src/selection-manager'
import { BoldPlugin } from '../src/bold-plugin'
import { ItalicPlugin } from '../src/italic-plugin'
import { UnderlinePlugin } from '../src/underline-plugin'
import { StrikePlugin } from '../src/strike-plugin'
import type { EditorContext } from '../../core/src/types'

describe('텍스트 스타일 플러그인 통합 (복합 스타일 적용)', () => {
  let eventBus: EventBus
  let pluginManager: PluginManager
  let selectionManager: SelectionManager
  let element: HTMLDivElement
  let context: EditorContext

  beforeEach(() => {
    // Given: 편집 가능한 요소와 에디터 컨텍스트 생성
    element = document.createElement('div')
    element.contentEditable = 'true'
    element.innerHTML = '<p>Hello World</p>'
    document.body.appendChild(element)

    eventBus = new EventBus()
    selectionManager = new SelectionManager(element)
    context = {
      eventBus,
      selectionManager,
      config: {},
    }
    pluginManager = new PluginManager(context)
  })

  afterEach(() => {
    document.body.removeChild(element)
  })

  describe('다중 플러그인 등록 (여러 플러그인 초기화)', () => {
    /**
     * Why: 여러 텍스트 스타일 플러그인을 동시에 사용할 수 있어야 함
     * How: `PluginManager.register()`로 4개 플러그인을 등록하고 `has()`로 확인
     */

    it('모든 텍스트 스타일 플러그인을 등록해야 함', async () => {
      // Given: 플러그인 매니저 준비

      // When: 4개 텍스트 스타일 플러그인 등록
      await pluginManager.register(BoldPlugin)
      await pluginManager.register(ItalicPlugin)
      await pluginManager.register(UnderlinePlugin)
      await pluginManager.register(StrikePlugin)

      // Then: 모든 플러그인이 등록되어야 함
      expect(pluginManager.has('text-style:bold')).toBe(true)
      expect(pluginManager.has('text-style:italic')).toBe(true)
      expect(pluginManager.has('text-style:underline')).toBe(true)
      expect(pluginManager.has('text-style:strike')).toBe(true)
      expect(pluginManager.size).toBe(4)
    })

    it('어떤 등록 순서에서도 동작해야 함', async () => {
      // Given: 플러그인 매니저 준비

      // When: 무작위 순서로 플러그인 등록
      await pluginManager.register(StrikePlugin)
      await pluginManager.register(BoldPlugin)
      await pluginManager.register(UnderlinePlugin)
      await pluginManager.register(ItalicPlugin)

      // Then: 등록 순서와 무관하게 4개 플러그인이 등록되어야 함
      expect(pluginManager.size).toBe(4)
    })
  })

  describe('복합 스타일 적용 (여러 스타일 조합)', () => {
    /**
     * Why: 사용자가 여러 스타일을 동시에 적용할 수 있어야 함
     * How: `EventBus.emit()`으로 여러 스타일 이벤트를 발생시키고 `execCommand` 호출 순서 검증
     */

    beforeEach(async () => {
      // Given: 모든 텍스트 스타일 플러그인 등록
      await pluginManager.register(BoldPlugin)
      await pluginManager.register(ItalicPlugin)
      await pluginManager.register(UnderlinePlugin)
      await pluginManager.register(StrikePlugin)
    })

    it('여러 스타일을 순차적으로 적용해야 함', () => {
      // Given: execCommand Mock 설정
      const execCommandSpy = vi
        .spyOn(document, 'execCommand')
        .mockReturnValue(true)

      // When: 3개 스타일 순차 적용
      eventBus.emit('BOLD_CLICKED')
      eventBus.emit('ITALIC_CLICKED')
      eventBus.emit('UNDERLINE_CLICKED')

      // Then: 각 스타일에 대해 execCommand가 올바른 순서로 호출되어야 함
      expect(execCommandSpy).toHaveBeenNthCalledWith(1, 'bold', false)
      expect(execCommandSpy).toHaveBeenNthCalledWith(2, 'italic', false)
      expect(execCommandSpy).toHaveBeenNthCalledWith(3, 'underline', false)
      expect(execCommandSpy).toHaveBeenCalledTimes(3)

      execCommandSpy.mockRestore()
    })

    it('각 스타일마다 개별 STYLE_CHANGED 이벤트를 발생시켜야 함', () => {
      // Given: execCommand Mock과 STYLE_CHANGED 리스너 설정
      vi.spyOn(document, 'execCommand').mockReturnValue(true)

      const styleChangedSpy = vi.fn()
      eventBus.on('STYLE_CHANGED', 'on', styleChangedSpy)

      // When: 3개 스타일 적용
      eventBus.emit('BOLD_CLICKED')
      eventBus.emit('ITALIC_CLICKED')
      eventBus.emit('STRIKE_CLICKED')

      // Then: STYLE_CHANGED 이벤트가 각 스타일에 대해 발생해야 함
      expect(styleChangedSpy).toHaveBeenCalledTimes(3)
      expect(styleChangedSpy).toHaveBeenNthCalledWith(1, { style: 'bold' })
      expect(styleChangedSpy).toHaveBeenNthCalledWith(2, { style: 'italic' })
      expect(styleChangedSpy).toHaveBeenNthCalledWith(3, { style: 'strike' })

      vi.restoreAllMocks()
    })

    it('4가지 스타일을 모두 함께 적용해야 함', () => {
      // Given: execCommand Mock 설정
      const execCommandSpy = vi
        .spyOn(document, 'execCommand')
        .mockReturnValue(true)

      // When: 모든 스타일 적용
      eventBus.emit('BOLD_CLICKED')
      eventBus.emit('ITALIC_CLICKED')
      eventBus.emit('UNDERLINE_CLICKED')
      eventBus.emit('STRIKE_CLICKED')

      // Then: 4번의 execCommand가 호출되어야 함
      expect(execCommandSpy).toHaveBeenCalledTimes(4)

      execCommandSpy.mockRestore()
    })
  })

  describe('IME 조합 차단 (입력 중 스타일 차단)', () => {
    /**
     * Why: CJK 입력 중 스타일 적용 시 문자 조합이 깨지는 것을 방지
     * How: `compositionstart` 이벤트로 조합 상태를 시뮬레이션하고 스타일 명령 차단 확인
     */

    beforeEach(async () => {
      // Given: 모든 텍스트 스타일 플러그인 등록
      await pluginManager.register(BoldPlugin)
      await pluginManager.register(ItalicPlugin)
      await pluginManager.register(UnderlinePlugin)
      await pluginManager.register(StrikePlugin)
    })

    it('조합 중 모든 텍스트 스타일 명령을 차단해야 함', () => {
      // Given: console.warn Mock과 조합 시작
      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const execCommandSpy = vi.spyOn(document, 'execCommand')

      element.dispatchEvent(new CompositionEvent('compositionstart'))
      expect(selectionManager.getIsComposing()).toBe(true)

      // When: 조합 중 모든 스타일 명령 시도
      const boldResult = eventBus.emit('BOLD_CLICKED')
      const italicResult = eventBus.emit('ITALIC_CLICKED')
      const underlineResult = eventBus.emit('UNDERLINE_CLICKED')
      const strikeResult = eventBus.emit('STRIKE_CLICKED')

      // Then: 모든 명령이 차단되어야 함
      expect(boldResult).toBe(false)
      expect(italicResult).toBe(false)
      expect(underlineResult).toBe(false)
      expect(strikeResult).toBe(false)

      expect(execCommandSpy).not.toHaveBeenCalled()
      expect(consoleWarn).toHaveBeenCalledTimes(4)

      consoleWarn.mockRestore()
      execCommandSpy.mockRestore()
    })

    it('조합 종료 후 모든 명령을 허용해야 함', () => {
      // Given: execCommand Mock과 조합 시작 후 종료
      const execCommandSpy = vi
        .spyOn(document, 'execCommand')
        .mockReturnValue(true)

      element.dispatchEvent(new CompositionEvent('compositionstart'))
      element.dispatchEvent(new CompositionEvent('compositionend'))
      expect(selectionManager.getIsComposing()).toBe(false)

      // When: 조합 종료 후 모든 스타일 명령 실행
      const boldResult = eventBus.emit('BOLD_CLICKED')
      const italicResult = eventBus.emit('ITALIC_CLICKED')
      const underlineResult = eventBus.emit('UNDERLINE_CLICKED')
      const strikeResult = eventBus.emit('STRIKE_CLICKED')

      // Then: 모든 명령이 성공해야 함
      expect(boldResult).toBe(true)
      expect(italicResult).toBe(true)
      expect(underlineResult).toBe(true)
      expect(strikeResult).toBe(true)

      expect(execCommandSpy).toHaveBeenCalledTimes(4)

      execCommandSpy.mockRestore()
    })
  })

  describe('플러그인 생명주기 (초기화/정리)', () => {
    /**
     * Why: 플러그인이 올바르게 정리되어 메모리 누수를 방지해야 함
     * How: `PluginManager.destroyAll()`로 전체 정리 후 이벤트 미반응 확인
     */

    it('모든 플러그인을 함께 정리해야 함', async () => {
      // Given: 4개 플러그인 등록
      await pluginManager.register(BoldPlugin)
      await pluginManager.register(ItalicPlugin)
      await pluginManager.register(UnderlinePlugin)
      await pluginManager.register(StrikePlugin)

      expect(pluginManager.size).toBe(4)

      // When: 모든 플러그인 정리
      pluginManager.destroyAll()

      // Then: 모든 플러그인이 제거되어야 함
      expect(pluginManager.size).toBe(0)
    })

    it('정리 후 이벤트에 반응하지 않아야 함', async () => {
      // Given: 4개 플러그인 등록 후 정리
      await pluginManager.register(BoldPlugin)
      await pluginManager.register(ItalicPlugin)
      await pluginManager.register(UnderlinePlugin)
      await pluginManager.register(StrikePlugin)

      const execCommandSpy = vi
        .spyOn(document, 'execCommand')
        .mockReturnValue(true)

      pluginManager.destroyAll()

      // When: 정리 후 모든 스타일 이벤트 발생
      eventBus.emit('BOLD_CLICKED')
      eventBus.emit('ITALIC_CLICKED')
      eventBus.emit('UNDERLINE_CLICKED')
      eventBus.emit('STRIKE_CLICKED')

      // Then: execCommand가 호출되지 않아야 함
      expect(execCommandSpy).not.toHaveBeenCalled()

      execCommandSpy.mockRestore()
    })
  })

  describe('에러 처리 (예외 상황 대응)', () => {
    /**
     * Why: 한 플러그인의 에러가 다른 플러그인에 영향을 주지 않아야 함
     * How: `execCommand`가 선택적으로 실패하도록 Mock하고 독립적인 에러 처리 확인
     */

    beforeEach(async () => {
      // Given: 모든 텍스트 스타일 플러그인 등록
      await pluginManager.register(BoldPlugin)
      await pluginManager.register(ItalicPlugin)
      await pluginManager.register(UnderlinePlugin)
      await pluginManager.register(StrikePlugin)
    })

    it('각 플러그인의 에러를 독립적으로 처리해야 함', () => {
      // Given: 특정 명령만 실패하도록 Mock 설정
      const consoleError = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {})

      const execCommandSpy = vi
        .spyOn(document, 'execCommand')
        .mockImplementation((command) => {
          if (command === 'bold') throw new Error('Bold failed')
          if (command === 'italic') return true
          if (command === 'underline') throw new Error('Underline failed')
          if (command === 'strikeThrough') return true
          return false
        })

      // When: 모든 스타일 명령 실행
      eventBus.emit('BOLD_CLICKED')
      eventBus.emit('ITALIC_CLICKED')
      eventBus.emit('UNDERLINE_CLICKED')
      eventBus.emit('STRIKE_CLICKED')

      // Then: 실패한 명령만 에러 로그가 기록되어야 함
      expect(consoleError).toHaveBeenCalledTimes(2)
      expect(execCommandSpy).toHaveBeenCalledTimes(4)

      consoleError.mockRestore()
      execCommandSpy.mockRestore()
    })

    it('한 플러그인 실패 후에도 계속 동작해야 함', () => {
      // Given: 첫 번째 호출만 실패하도록 Mock 설정
      const consoleError = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {})

      const execCommandSpy = vi
        .spyOn(document, 'execCommand')
        .mockImplementationOnce(() => {
          throw new Error('Failed')
        })
        .mockReturnValue(true)

      // When: Bold 실패 후 Italic 실행
      eventBus.emit('BOLD_CLICKED')
      expect(consoleError).toHaveBeenCalledTimes(1)

      eventBus.emit('ITALIC_CLICKED')

      // Then: Italic은 정상 동작해야 함
      expect(execCommandSpy).toHaveBeenCalledTimes(2)

      consoleError.mockRestore()
      execCommandSpy.mockRestore()
    })
  })

  describe('이벤트 단계 조율 (여러 플러그인 단계 실행)', () => {
    /**
     * Why: `EventBus`의 3단계(BEFORE → ON → AFTER)가 여러 플러그인에서 올바르게 실행되어야 함
     * How: 각 단계에 핸들러를 등록하고 실행 순서를 배열로 기록하여 검증
     */

    beforeEach(async () => {
      // Given: Bold와 Italic 플러그인 등록
      await pluginManager.register(BoldPlugin)
      await pluginManager.register(ItalicPlugin)
    })

    it('여러 플러그인에서 단계를 올바른 순서로 실행해야 함', () => {
      // Given: execCommand Mock과 실행 순서 추적 설정
      vi.spyOn(document, 'execCommand').mockReturnValue(true)

      const executionOrder: string[] = []

      eventBus.on('BOLD_CLICKED', 'before', () => {
        executionOrder.push('bold-before')
        return true
      })
      eventBus.on('BOLD_CLICKED', 'on', () => {
        executionOrder.push('bold-on')
        return true
      })
      eventBus.on('BOLD_CLICKED', 'after', () => {
        executionOrder.push('bold-after')
      })

      eventBus.on('ITALIC_CLICKED', 'before', () => {
        executionOrder.push('italic-before')
        return true
      })
      eventBus.on('ITALIC_CLICKED', 'on', () => {
        executionOrder.push('italic-on')
        return true
      })
      eventBus.on('ITALIC_CLICKED', 'after', () => {
        executionOrder.push('italic-after')
      })

      // When: Bold와 Italic 이벤트 발생
      eventBus.emit('BOLD_CLICKED')
      eventBus.emit('ITALIC_CLICKED')

      // Then: 각 이벤트의 3단계가 순서대로 실행되어야 함
      expect(executionOrder).toEqual([
        'bold-before',
        'bold-on',
        'bold-after',
        'italic-before',
        'italic-on',
        'italic-after',
      ])

      vi.restoreAllMocks()
    })
  })

  describe('실제 시나리오 (사용자 동작 시뮬레이션)', () => {
    /**
     * Why: 실제 사용자의 편집 패턴을 시뮬레이션하여 통합 동작 확인
     * How: 툴바 클릭, 키보드 단축키, 연속 클릭 등 실제 시나리오 재현
     */

    beforeEach(async () => {
      // Given: 모든 텍스트 스타일 플러그인 등록
      await pluginManager.register(BoldPlugin)
      await pluginManager.register(ItalicPlugin)
      await pluginManager.register(UnderlinePlugin)
      await pluginManager.register(StrikePlugin)
    })

    it('서식 도구 모음 클릭 순서를 처리해야 함', () => {
      // Given: execCommand Mock 설정
      const execCommandSpy = vi
        .spyOn(document, 'execCommand')
        .mockReturnValue(true)

      // When: 사용자가 Bold → Italic → Bold(토글) → Underline 순서로 클릭
      eventBus.emit('BOLD_CLICKED')
      eventBus.emit('ITALIC_CLICKED')
      eventBus.emit('BOLD_CLICKED')
      eventBus.emit('UNDERLINE_CLICKED')

      // Then: 모든 클릭이 올바른 순서로 처리되어야 함
      expect(execCommandSpy).toHaveBeenCalledTimes(4)
      expect(execCommandSpy).toHaveBeenNthCalledWith(1, 'bold', false)
      expect(execCommandSpy).toHaveBeenNthCalledWith(2, 'italic', false)
      expect(execCommandSpy).toHaveBeenNthCalledWith(3, 'bold', false)
      expect(execCommandSpy).toHaveBeenNthCalledWith(4, 'underline', false)

      execCommandSpy.mockRestore()
    })

    it('키보드 단축키 시뮬레이션을 처리해야 함', () => {
      // Given: execCommand Mock 설정
      const execCommandSpy = vi
        .spyOn(document, 'execCommand')
        .mockReturnValue(true)

      // When: Ctrl+B, Ctrl+I, Ctrl+U 단축키 시뮬레이션
      eventBus.emit('BOLD_CLICKED')
      eventBus.emit('ITALIC_CLICKED')
      eventBus.emit('UNDERLINE_CLICKED')

      // Then: 3개 단축키가 모두 처리되어야 함
      expect(execCommandSpy).toHaveBeenCalledTimes(3)

      execCommandSpy.mockRestore()
    })

    it('빠른 연속 클릭을 처리해야 함', () => {
      // Given: execCommand Mock 설정
      const execCommandSpy = vi
        .spyOn(document, 'execCommand')
        .mockReturnValue(true)

      // When: Bold를 10번 연속 클릭 (더블클릭 또는 실수 클릭)
      for (let i = 0; i < 10; i++) {
        eventBus.emit('BOLD_CLICKED')
      }

      // Then: 모든 클릭이 처리되어야 함
      expect(execCommandSpy).toHaveBeenCalledTimes(10)

      execCommandSpy.mockRestore()
    })
  })
})
