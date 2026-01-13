import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { EventBus } from '@/core/event-bus'
import { PluginManager } from '@/core/plugin-manager'
import { SelectionManager } from '@/core/selection-manager'
import {
  createOrderedListPlugin,
  OrderedListPlugin,
} from '@/plugins/ordered-list-plugin'
import {
  createUnorderedListPlugin,
  UnorderedListPlugin,
} from '@/plugins/unordered-list-plugin'
import type { EditorContext } from '@/core/types'

describe('OrderedListPlugin', () => {
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

  describe('플러그인 등록 (기본 초기화)', () => {
    /**
     * Why: `OrderedListPlugin`이 `PluginManager`에 정상적으로 등록되는지 확인
     * How: 기본 플러그인과 커스텀 옵션 플러그인을 등록한 후 `pluginManager.has()`로 검증
     */

    it('OrderedListPlugin', async () => {
      // Given: 빈 PluginManager
      // When: OrderedListPlugin 등록
      await pluginManager.register(OrderedListPlugin)

      // Then: 플러그인이 등록되어야 함
      expect(pluginManager.has('paragraph:ordered-list')).toBe(true)
      expect(pluginManager.size).toBe(1)
    })

    it('커스텀 옵션으로 플러그인을 생성해야 함', async () => {
      // Given: 커스텀 옵션을 가진 순서 있는 목록 플러그인
      const customPlugin = createOrderedListPlugin({
        eventName: 'CUSTOM_OL',
        checkComposition: false,
      })

      // When: 커스텀 플러그인 등록
      await pluginManager.register(customPlugin)

      // Then: 플러그인이 등록되어야 함
      expect(pluginManager.has('paragraph:ordered-list')).toBe(true)
    })
  })

  describe('List command execution', () => {
    /**
     * Why: 실제 브라우저 환경에서 순서 있는 목록 명령이 올바르게 실행되는지 검증
     * How: 선택 영역을 생성한 후 `ORDERED_LIST_CLICKED` 이벤트를 발행하여 `execCommand`로 `insertOrderedList` 호출 확인
     */

    beforeEach(async () => {
      await pluginManager.register(OrderedListPlugin)
    })

    it('should execute insertOrderedList command', () => {
      // Given: execCommand spy와 선택 영역
      const execCommandSpy = vi.spyOn(document, 'execCommand')

      const textNode = element.firstChild!.firstChild as Text
      const range = document.createRange()
      range.setStart(textNode, 0)
      range.setEnd(textNode, 5)

      const selection = window.getSelection()!
      selection.removeAllRanges()
      selection.addRange(range)

      // When: 순서 있는 목록 이벤트 발행
      const result = eventBus.emit('ORDERED_LIST_CLICKED')

      // Then: insertOrderedList 명령이 실행되어야 함
      expect(result).toBe(true)
      expect(execCommandSpy).toHaveBeenCalledWith('insertOrderedList', false)

      execCommandSpy.mockRestore()
    })

    it('should emit STYLE_CHANGED event after successful list creation', () => {
      // Given: execCommand mock과 STYLE_CHANGED 리스너
      vi.spyOn(document, 'execCommand').mockReturnValue(true)

      const styleChangedSpy = vi.fn()
      eventBus.on('STYLE_CHANGED', 'on', styleChangedSpy)

      // When: 순서 있는 목록 이벤트 발행
      eventBus.emit('ORDERED_LIST_CLICKED')

      // Then: STYLE_CHANGED 이벤트가 발행되어야 함
      expect(styleChangedSpy).toHaveBeenCalledWith({
        style: 'orderedList',
      })

      vi.restoreAllMocks()
    })

    it('should not emit STYLE_CHANGED if execCommand fails', () => {
      // Given: 실패하는 execCommand mock
      vi.spyOn(document, 'execCommand').mockReturnValue(false)

      const styleChangedSpy = vi.fn()
      eventBus.on('STYLE_CHANGED', 'on', styleChangedSpy)

      // When: 순서 있는 목록 이벤트 발행
      eventBus.emit('ORDERED_LIST_CLICKED')

      // Then: STYLE_CHANGED 이벤트가 발행되지 않아야 함
      expect(styleChangedSpy).not.toHaveBeenCalled()

      vi.restoreAllMocks()
    })
  })

  describe('CJK/IME 입력 지원 (조합 문자 처리)', () => {
    /**
     * Why: IME 입력 중 목록 생성으로 인한 조합 문자 입력 방해 방지
     * How: `SelectionManager`의 조합 상태를 확인하여 IME 입력 중일 때 목록 생성 차단
     */

    beforeEach(async () => {
      await pluginManager.register(OrderedListPlugin)
    })

    it('should block list creation during IME composition', () => {
      // Given: IME 조합 중인 상태
      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const execCommandSpy = vi.spyOn(document, 'execCommand')

      element.dispatchEvent(new CompositionEvent('compositionstart'))
      expect(selectionManager.getIsComposing()).toBe(true)

      // When: 목록 생성 시도
      const result = eventBus.emit('ORDERED_LIST_CLICKED')

      // Then: 차단되고 경고 발생
      expect(result).toBe(false)
      expect(consoleWarn).toHaveBeenCalledWith(
        'Ordered list blocked: IME composition in progress'
      )
      expect(execCommandSpy).not.toHaveBeenCalled()

      consoleWarn.mockRestore()
      execCommandSpy.mockRestore()
    })

    it('should allow list creation after composition ends', () => {
      // Given: IME 조합 종료 상태
      const execCommandSpy = vi
        .spyOn(document, 'execCommand')
        .mockReturnValue(true)

      element.dispatchEvent(new CompositionEvent('compositionstart'))
      element.dispatchEvent(new CompositionEvent('compositionend'))
      expect(selectionManager.getIsComposing()).toBe(false)

      // When: 목록 생성 시도
      const result = eventBus.emit('ORDERED_LIST_CLICKED')

      // Then: 정상 실행되어야 함
      expect(result).toBe(true)
      expect(execCommandSpy).toHaveBeenCalled()

      execCommandSpy.mockRestore()
    })
  })

  describe('에러 처리 (예외 상황 대응)', () => {
    /**
     * Why: `execCommand` 실행 중 발생하는 예외를 안전하게 처리하는지 검증
     * How: `execCommand`에서 예외를 발생시켜 에러 핸들링 동작 확인
     */

    beforeEach(async () => {
      await pluginManager.register(OrderedListPlugin)
    })

    it('execCommand 에러를 안전하게 처리해야 함', () => {
      // Given: 예외를 발생시키는 execCommand
      const consoleError = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {})

      vi.spyOn(document, 'execCommand').mockImplementation(() => {
        throw new Error('execCommand failed')
      })

      // When: 목록 생성 시도
      const result = eventBus.emit('ORDERED_LIST_CLICKED')

      // Then: 에러 로그 발생 및 false 반환
      expect(result).toBe(false)
      expect(consoleError).toHaveBeenCalledWith(
        'Failed to execute ordered list command:',
        expect.any(Error)
      )

      consoleError.mockRestore()
      vi.restoreAllMocks()
    })
  })

  describe('플러그인 생명주기 (초기화/정리)', () => {
    /**
     * Why: 플러그인 destroy 시 이벤트 리스너가 정상적으로 제거되는지 검증
     * How: 플러그인 등록 후 destroy를 호출하여 이벤트가 더 이상 처리되지 않는지 확인
     */

    it('destroy 시 정리를 수행해야 함', async () => {
      // Given: 등록된 플러그인
      await pluginManager.register(OrderedListPlugin)

      const execCommandSpy = vi
        .spyOn(document, 'execCommand')
        .mockReturnValue(true)

      let result = eventBus.emit('ORDERED_LIST_CLICKED')
      expect(result).toBe(true)
      expect(execCommandSpy).toHaveBeenCalledTimes(1)

      // When: 플러그인 destroy
      pluginManager.destroyAll()

      // Then: 이벤트가 더 이상 처리되지 않아야 함
      execCommandSpy.mockClear()
      result = eventBus.emit('ORDERED_LIST_CLICKED')

      expect(execCommandSpy).not.toHaveBeenCalled()

      execCommandSpy.mockRestore()
    })
  })

  describe('커스텀 이벤트 이름 (이벤트 설정)', () => {
    /**
     * Why: 다른 이벤트 이름을 사용하여 플러그인을 커스터마이즈할 수 있는지 검증
     * How: `eventName` 옵션으로 커스텀 이벤트를 설정하고 해당 이벤트로 동작 확인
     */

    it('커스텀 이벤트 이름을 수신해야 함', async () => {
      // Given: 커스텀 이벤트 이름을 가진 플러그인
      const customPlugin = createOrderedListPlugin({
        eventName: 'MY_OL_EVENT',
      })

      await pluginManager.register(customPlugin)

      const execCommandSpy = vi
        .spyOn(document, 'execCommand')
        .mockReturnValue(true)

      // When: 커스텀 이벤트 발행
      const result = eventBus.emit('MY_OL_EVENT')

      // Then: 정상 실행되어야 함
      expect(result).toBe(true)
      expect(execCommandSpy).toHaveBeenCalledWith('insertOrderedList', false)

      execCommandSpy.mockRestore()
    })
  })
})

describe('UnorderedListPlugin', () => {
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

  describe('플러그인 등록 (기본 초기화)', () => {
    /**
     * Why: `UnorderedListPlugin`이 `PluginManager`에 정상적으로 등록되는지 확인
     * How: 기본 플러그인과 커스텀 옵션 플러그인을 등록한 후 `pluginManager.has()`로 검증
     */

    it('UnorderedListPlugin', async () => {
      // Given: 빈 PluginManager
      // When: UnorderedListPlugin 등록
      await pluginManager.register(UnorderedListPlugin)

      // Then: 플러그인이 등록되어야 함
      expect(pluginManager.has('paragraph:unordered-list')).toBe(true)
      expect(pluginManager.size).toBe(1)
    })

    it('커스텀 옵션으로 플러그인을 생성해야 함', async () => {
      // Given: 커스텀 옵션을 가진 순서 없는 목록 플러그인
      const customPlugin = createUnorderedListPlugin({
        eventName: 'CUSTOM_UL',
        checkComposition: false,
      })

      // When: 커스텀 플러그인 등록
      await pluginManager.register(customPlugin)

      // Then: 플러그인이 등록되어야 함
      expect(pluginManager.has('paragraph:unordered-list')).toBe(true)
    })
  })

  describe('List command execution', () => {
    /**
     * Why: 실제 브라우저 환경에서 순서 없는 목록 명령이 올바르게 실행되는지 검증
     * How: 선택 영역을 생성한 후 `UNORDERED_LIST_CLICKED` 이벤트를 발행하여 `execCommand`로 `insertUnorderedList` 호출 확인
     */

    beforeEach(async () => {
      await pluginManager.register(UnorderedListPlugin)
    })

    it('should execute insertUnorderedList command', () => {
      // Given: execCommand spy와 선택 영역
      const execCommandSpy = vi.spyOn(document, 'execCommand')

      const textNode = element.firstChild!.firstChild as Text
      const range = document.createRange()
      range.setStart(textNode, 0)
      range.setEnd(textNode, 5)

      const selection = window.getSelection()!
      selection.removeAllRanges()
      selection.addRange(range)

      // When: 순서 없는 목록 이벤트 발행
      const result = eventBus.emit('UNORDERED_LIST_CLICKED')

      // Then: insertUnorderedList 명령이 실행되어야 함
      expect(result).toBe(true)
      expect(execCommandSpy).toHaveBeenCalledWith('insertUnorderedList', false)

      execCommandSpy.mockRestore()
    })

    it('should emit STYLE_CHANGED event after successful list creation', () => {
      // Given: execCommand mock과 STYLE_CHANGED 리스너
      vi.spyOn(document, 'execCommand').mockReturnValue(true)

      const styleChangedSpy = vi.fn()
      eventBus.on('STYLE_CHANGED', 'on', styleChangedSpy)

      // When: 순서 없는 목록 이벤트 발행
      eventBus.emit('UNORDERED_LIST_CLICKED')

      // Then: STYLE_CHANGED 이벤트가 발행되어야 함
      expect(styleChangedSpy).toHaveBeenCalledWith({
        style: 'unorderedList',
      })

      vi.restoreAllMocks()
    })

    it('should not emit STYLE_CHANGED if execCommand fails', () => {
      // Given: 실패하는 execCommand mock
      vi.spyOn(document, 'execCommand').mockReturnValue(false)

      const styleChangedSpy = vi.fn()
      eventBus.on('STYLE_CHANGED', 'on', styleChangedSpy)

      // When: 순서 없는 목록 이벤트 발행
      eventBus.emit('UNORDERED_LIST_CLICKED')

      // Then: STYLE_CHANGED 이벤트가 발행되지 않아야 함
      expect(styleChangedSpy).not.toHaveBeenCalled()

      vi.restoreAllMocks()
    })
  })

  describe('CJK/IME 입력 지원 (조합 문자 처리)', () => {
    /**
     * Why: IME 입력 중 목록 생성으로 인한 조합 문자 입력 방해 방지
     * How: `SelectionManager`의 조합 상태를 확인하여 IME 입력 중일 때 목록 생성 차단
     */

    beforeEach(async () => {
      await pluginManager.register(UnorderedListPlugin)
    })

    it('should block list creation during IME composition', () => {
      // Given: IME 조합 중인 상태
      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const execCommandSpy = vi.spyOn(document, 'execCommand')

      element.dispatchEvent(new CompositionEvent('compositionstart'))
      expect(selectionManager.getIsComposing()).toBe(true)

      // When: 목록 생성 시도
      const result = eventBus.emit('UNORDERED_LIST_CLICKED')

      // Then: 차단되고 경고 발생
      expect(result).toBe(false)
      expect(consoleWarn).toHaveBeenCalledWith(
        'Unordered list blocked: IME composition in progress'
      )
      expect(execCommandSpy).not.toHaveBeenCalled()

      consoleWarn.mockRestore()
      execCommandSpy.mockRestore()
    })

    it('should allow list creation after composition ends', () => {
      // Given: IME 조합 종료 상태
      const execCommandSpy = vi
        .spyOn(document, 'execCommand')
        .mockReturnValue(true)

      element.dispatchEvent(new CompositionEvent('compositionstart'))
      element.dispatchEvent(new CompositionEvent('compositionend'))
      expect(selectionManager.getIsComposing()).toBe(false)

      // When: 목록 생성 시도
      const result = eventBus.emit('UNORDERED_LIST_CLICKED')

      // Then: 정상 실행되어야 함
      expect(result).toBe(true)
      expect(execCommandSpy).toHaveBeenCalled()

      execCommandSpy.mockRestore()
    })
  })

  describe('에러 처리 (예외 상황 대응)', () => {
    /**
     * Why: `execCommand` 실행 중 발생하는 예외를 안전하게 처리하는지 검증
     * How: `execCommand`에서 예외를 발생시켜 에러 핸들링 동작 확인
     */

    beforeEach(async () => {
      await pluginManager.register(UnorderedListPlugin)
    })

    it('execCommand 에러를 안전하게 처리해야 함', () => {
      // Given: 예외를 발생시키는 execCommand
      const consoleError = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {})

      vi.spyOn(document, 'execCommand').mockImplementation(() => {
        throw new Error('execCommand failed')
      })

      // When: 목록 생성 시도
      const result = eventBus.emit('UNORDERED_LIST_CLICKED')

      // Then: 에러 로그 발생 및 false 반환
      expect(result).toBe(false)
      expect(consoleError).toHaveBeenCalledWith(
        'Failed to execute unordered list command:',
        expect.any(Error)
      )

      consoleError.mockRestore()
      vi.restoreAllMocks()
    })
  })

  describe('플러그인 생명주기 (초기화/정리)', () => {
    /**
     * Why: 플러그인 destroy 시 이벤트 리스너가 정상적으로 제거되는지 검증
     * How: 플러그인 등록 후 destroy를 호출하여 이벤트가 더 이상 처리되지 않는지 확인
     */

    it('destroy 시 정리를 수행해야 함', async () => {
      // Given: 등록된 플러그인
      await pluginManager.register(UnorderedListPlugin)

      const execCommandSpy = vi
        .spyOn(document, 'execCommand')
        .mockReturnValue(true)

      let result = eventBus.emit('UNORDERED_LIST_CLICKED')
      expect(result).toBe(true)
      expect(execCommandSpy).toHaveBeenCalledTimes(1)

      // When: 플러그인 destroy
      pluginManager.destroyAll()

      // Then: 이벤트가 더 이상 처리되지 않아야 함
      execCommandSpy.mockClear()
      result = eventBus.emit('UNORDERED_LIST_CLICKED')

      expect(execCommandSpy).not.toHaveBeenCalled()

      execCommandSpy.mockRestore()
    })
  })

  describe('커스텀 이벤트 이름 (이벤트 설정)', () => {
    /**
     * Why: 다른 이벤트 이름을 사용하여 플러그인을 커스터마이즈할 수 있는지 검증
     * How: `eventName` 옵션으로 커스텀 이벤트를 설정하고 해당 이벤트로 동작 확인
     */

    it('커스텀 이벤트 이름을 수신해야 함', async () => {
      // Given: 커스텀 이벤트 이름을 가진 플러그인
      const customPlugin = createUnorderedListPlugin({
        eventName: 'MY_UL_EVENT',
      })

      await pluginManager.register(customPlugin)

      const execCommandSpy = vi
        .spyOn(document, 'execCommand')
        .mockReturnValue(true)

      // When: 커스텀 이벤트 발행
      const result = eventBus.emit('MY_UL_EVENT')

      // Then: 정상 실행되어야 함
      expect(result).toBe(true)
      expect(execCommandSpy).toHaveBeenCalledWith('insertUnorderedList', false)

      execCommandSpy.mockRestore()
    })
  })
})

describe('List Plugins Integration', () => {
  /**
   * Why: 순서 있는 목록과 순서 없는 목록 플러그인들이 함께 동작할 때 올바르게 작동하는지 검증
   * How: 두 플러그인을 동시에 등록하고 목록 타입 전환 등의 통합 시나리오 테스트
   */

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

  describe('Multiple list plugins', () => {
    beforeEach(async () => {
      await pluginManager.register(OrderedListPlugin)
      await pluginManager.register(UnorderedListPlugin)
    })

    it('both list plugins', () => {
      // Given: 두 플러그인 등록
      // When: 플러그인 등록 상태 확인
      // Then: 두 플러그인 모두 등록되어 있어야 함
      expect(pluginManager.has('paragraph:ordered-list')).toBe(true)
      expect(pluginManager.has('paragraph:unordered-list')).toBe(true)
      expect(pluginManager.size).toBe(2)
    })

    it('should handle switching between list types', () => {
      // Given: execCommand spy
      const execCommandSpy = vi
        .spyOn(document, 'execCommand')
        .mockReturnValue(true)

      // When: 목록 타입 전환
      eventBus.emit('ORDERED_LIST_CLICKED')
      eventBus.emit('UNORDERED_LIST_CLICKED')
      eventBus.emit('ORDERED_LIST_CLICKED')

      // Then: 각 명령이 순서대로 실행되어야 함
      expect(execCommandSpy).toHaveBeenCalledTimes(3)
      expect(execCommandSpy).toHaveBeenNthCalledWith(
        1,
        'insertOrderedList',
        false
      )
      expect(execCommandSpy).toHaveBeenNthCalledWith(
        2,
        'insertUnorderedList',
        false
      )
      expect(execCommandSpy).toHaveBeenNthCalledWith(
        3,
        'insertOrderedList',
        false
      )

      execCommandSpy.mockRestore()
    })

    it('should emit separate STYLE_CHANGED events', () => {
      // Given: execCommand mock과 STYLE_CHANGED 리스너
      vi.spyOn(document, 'execCommand').mockReturnValue(true)

      const styleChangedSpy = vi.fn()
      eventBus.on('STYLE_CHANGED', 'on', styleChangedSpy)

      // When: 순서 있는 목록과 순서 없는 목록 실행
      eventBus.emit('ORDERED_LIST_CLICKED')
      eventBus.emit('UNORDERED_LIST_CLICKED')

      // Then: 각각 별도의 STYLE_CHANGED 이벤트 발행
      expect(styleChangedSpy).toHaveBeenCalledTimes(2)
      expect(styleChangedSpy).toHaveBeenNthCalledWith(1, {
        style: 'orderedList',
      })
      expect(styleChangedSpy).toHaveBeenNthCalledWith(2, {
        style: 'unorderedList',
      })

      vi.restoreAllMocks()
    })
  })
})
