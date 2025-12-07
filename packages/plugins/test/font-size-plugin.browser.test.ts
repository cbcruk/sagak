import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { EventBus } from '../../core/src/event-bus'
import { PluginManager } from '../../core/src/plugin-manager'
import { SelectionManager } from '../../core/src/selection-manager'
import { createFontSizePlugin, FontSizePlugin } from '../src/font-size-plugin'
import type { EditorContext } from '../../core/src/types'

describe('FontSizePlugin (글자 크기 설정)', () => {
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
     * Why: 플러그인이 `PluginManager`에 올바르게 등록되어야 사용 가능
     * How: `register()` 호출 후 `has()` 및 `size`로 등록 확인
     */

    it('FontSizePlugin을 등록해야 함', async () => {
      // Given: 빈 PluginManager

      // When: FontSizePlugin 등록
      await pluginManager.register(FontSizePlugin)

      // Then: 플러그인이 등록됨
      expect(pluginManager.has('text-style:font-size')).toBe(true)
      expect(pluginManager.size).toBe(1)
    })

    it('커스텀 옵션으로 플러그인을 생성해야 함', async () => {
      // Given: 커스텀 옵션이 적용된 플러그인
      const customPlugin = createFontSizePlugin({
        eventName: 'CUSTOM_FONT_SIZE',
        checkComposition: false,
        minSize: 1,
        maxSize: 7,
      })

      // When: 커스텀 플러그인 등록
      await pluginManager.register(customPlugin)

      // Then: 동일한 이름으로 등록됨
      expect(pluginManager.has('text-style:font-size')).toBe(true)
    })
  })

  describe('글자 크기 명령 실행 (fontSize 설정)', () => {
    /**
     * Why: 사용자가 글자 크기를 선택하면 선택된 텍스트에 크기 적용
     * How: `FONT_SIZE_CHANGED` 이벤트 수신 → `execCommand('fontSize')` 실행
     */

    beforeEach(async () => {
      await pluginManager.register(FontSizePlugin)
    })

    it('제공된 크기로 fontSize 명령을 실행해야 함', () => {
      // Given: 텍스트가 선택된 상태
      const execCommandSpy = vi.spyOn(document, 'execCommand')
      const textNode = element.firstChild!.firstChild as Text
      const range = document.createRange()
      range.setStart(textNode, 0)
      range.setEnd(textNode, 5)

      const selection = window.getSelection()!
      selection.removeAllRanges()
      selection.addRange(range)

      // When: FONT_SIZE_CHANGED 이벤트 발생
      const result = eventBus.emit('FONT_SIZE_CHANGED', { fontSize: 3 })

      // Then: execCommand가 호출되고 성공 반환
      expect(result).toBe(true)
      expect(execCommandSpy).toHaveBeenCalledWith('fontSize', false, '3')

      execCommandSpy.mockRestore()
    })

    it('크기 변경 성공 후 STYLE_CHANGED 이벤트를 발생시켜야 함', () => {
      // Given: execCommand가 성공하는 상태
      vi.spyOn(document, 'execCommand').mockReturnValue(true)
      const styleChangedSpy = vi.fn()
      eventBus.on('STYLE_CHANGED', 'on', styleChangedSpy)

      // When: FONT_SIZE_CHANGED 이벤트 발생
      eventBus.emit('FONT_SIZE_CHANGED', { fontSize: 5 })

      // Then: STYLE_CHANGED 이벤트가 발생함
      expect(styleChangedSpy).toHaveBeenCalledWith({
        style: 'fontSize',
        value: 5,
      })

      vi.restoreAllMocks()
    })

    it('execCommand 실패 시 STYLE_CHANGED를 발생시키지 않아야 함', () => {
      // Given: execCommand가 실패하는 상태
      vi.spyOn(document, 'execCommand').mockReturnValue(false)
      const styleChangedSpy = vi.fn()
      eventBus.on('STYLE_CHANGED', 'on', styleChangedSpy)

      // When: FONT_SIZE_CHANGED 이벤트 발생
      eventBus.emit('FONT_SIZE_CHANGED', { fontSize: 3 })

      // Then: STYLE_CHANGED 이벤트가 발생하지 않음
      expect(styleChangedSpy).not.toHaveBeenCalled()

      vi.restoreAllMocks()
    })

    it('모든 유효한 글자 크기(1-7)를 처리해야 함', () => {
      // Given: execCommand가 성공하는 상태
      const execCommandSpy = vi
        .spyOn(document, 'execCommand')
        .mockReturnValue(true)

      // When: 모든 유효한 크기(1-7)로 이벤트 발생
      for (let size = 1; size <= 7; size++) {
        eventBus.emit('FONT_SIZE_CHANGED', { fontSize: size })
      }

      // Then: 모든 크기에 대해 execCommand 호출됨
      expect(execCommandSpy).toHaveBeenCalledTimes(7)
      for (let size = 1; size <= 7; size++) {
        expect(execCommandSpy).toHaveBeenCalledWith(
          'fontSize',
          false,
          String(size)
        )
      }

      execCommandSpy.mockRestore()
    })
  })

  describe('검증 (입력값 확인)', () => {
    /**
     * Why: 잘못된 입력값으로 인한 오류를 방지해야 함
     * How: 이벤트 데이터의 fontSize 값 유효성 검증
     */

    beforeEach(async () => {
      await pluginManager.register(FontSizePlugin)
    })

    it('fontSize가 제공되지 않으면 차단해야 함', () => {
      // Given: fontSize가 없는 이벤트 데이터
      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const execCommandSpy = vi.spyOn(document, 'execCommand')

      // When: fontSize 없이 이벤트 발생
      const result = eventBus.emit('FONT_SIZE_CHANGED', {})

      // Then: 차단됨
      expect(result).toBe(false)
      expect(consoleWarn).toHaveBeenCalledWith(
        'Font size blocked: Invalid font size'
      )
      expect(execCommandSpy).not.toHaveBeenCalled()

      consoleWarn.mockRestore()
      execCommandSpy.mockRestore()
    })

    it('data가 undefined면 차단해야 함', () => {
      // Given: 데이터 없이 이벤트

      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const execCommandSpy = vi.spyOn(document, 'execCommand')

      // When: 데이터 없이 이벤트 발생
      const result = eventBus.emit('FONT_SIZE_CHANGED')

      // Then: 차단됨
      expect(result).toBe(false)
      expect(consoleWarn).toHaveBeenCalled()
      expect(execCommandSpy).not.toHaveBeenCalled()

      consoleWarn.mockRestore()
      execCommandSpy.mockRestore()
    })

    it('숫자가 아닌 글자 크기를 차단해야 함', () => {
      // Given: 문자열 fontSize
      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const execCommandSpy = vi.spyOn(document, 'execCommand')

      // When: 문자열 fontSize로 이벤트 발생
      const result = eventBus.emit('FONT_SIZE_CHANGED', {
        fontSize: 'large',
      })

      // Then: 차단됨
      expect(result).toBe(false)
      expect(consoleWarn).toHaveBeenCalledWith(
        'Font size blocked: Invalid font size'
      )
      expect(execCommandSpy).not.toHaveBeenCalled()

      consoleWarn.mockRestore()
      execCommandSpy.mockRestore()
    })

    it('최소값 미만의 글자 크기를 차단해야 함', () => {
      // Given: 범위 미만의 fontSize
      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const execCommandSpy = vi.spyOn(document, 'execCommand')

      // When: 0 fontSize로 이벤트 발생
      const result = eventBus.emit('FONT_SIZE_CHANGED', { fontSize: 0 })

      // Then: 차단됨
      expect(result).toBe(false)
      expect(consoleWarn).toHaveBeenCalledWith(
        'Font size blocked: Size 0 is outside range 1-7'
      )
      expect(execCommandSpy).not.toHaveBeenCalled()

      consoleWarn.mockRestore()
      execCommandSpy.mockRestore()
    })

    it('최대값 초과의 글자 크기를 차단해야 함', () => {
      // Given: 범위 초과의 fontSize
      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const execCommandSpy = vi.spyOn(document, 'execCommand')

      // When: 8 fontSize로 이벤트 발생
      const result = eventBus.emit('FONT_SIZE_CHANGED', { fontSize: 8 })

      // Then: 차단됨
      expect(result).toBe(false)
      expect(consoleWarn).toHaveBeenCalledWith(
        'Font size blocked: Size 8 is outside range 1-7'
      )
      expect(execCommandSpy).not.toHaveBeenCalled()

      consoleWarn.mockRestore()
      execCommandSpy.mockRestore()
    })

    it('커스텀 minSize로 fontSize: 0을 허용해야 함', async () => {
      // Given: minSize: 0으로 설정된 플러그인
      pluginManager.destroyAll()

      const customPlugin = createFontSizePlugin({
        minSize: 0,
        maxSize: 10,
      })

      const newContext = {
        eventBus,
        selectionManager,
        config: {},
      }
      const newManager = new PluginManager(newContext)
      await newManager.register(customPlugin)

      const execCommandSpy = vi
        .spyOn(document, 'execCommand')
        .mockReturnValue(true)

      // When: fontSize: 0으로 이벤트 발생
      const result = eventBus.emit('FONT_SIZE_CHANGED', { fontSize: 0 })

      // Then: 허용됨
      expect(result).toBe(true)
      expect(execCommandSpy).toHaveBeenCalled()

      execCommandSpy.mockRestore()
      newManager.destroyAll()
    })
  })

  describe('CJK/IME 입력 지원 (조합 문자 처리)', () => {
    /**
     * Why: 한글 등 조합 문자 입력 중 글자 크기 변경 시 입력이 깨질 수 있음
     * How: `SelectionManager.getIsComposing()`으로 조합 상태 확인 후 차단
     */

    beforeEach(async () => {
      await pluginManager.register(FontSizePlugin)
    })

    it('IME 입력 중에는 글자 크기 변경을 차단해야 함', () => {
      // Given: IME 조합 중인 상태
      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const execCommandSpy = vi.spyOn(document, 'execCommand')

      element.dispatchEvent(new CompositionEvent('compositionstart'))
      expect(selectionManager.getIsComposing()).toBe(true)

      // When: 글자 크기 변경 시도
      const result = eventBus.emit('FONT_SIZE_CHANGED', { fontSize: 3 })

      // Then: BEFORE 단계에서 차단됨
      expect(result).toBe(false)
      expect(consoleWarn).toHaveBeenCalledWith(
        'Font size blocked: IME composition in progress'
      )
      expect(execCommandSpy).not.toHaveBeenCalled()

      consoleWarn.mockRestore()
      execCommandSpy.mockRestore()
    })

    it('조합 종료 후에는 글자 크기 변경을 허용해야 함', () => {
      // Given: IME 조합이 종료된 상태
      const execCommandSpy = vi
        .spyOn(document, 'execCommand')
        .mockReturnValue(true)

      element.dispatchEvent(new CompositionEvent('compositionstart'))
      element.dispatchEvent(new CompositionEvent('compositionend'))
      expect(selectionManager.getIsComposing()).toBe(false)

      // When: 글자 크기 변경 실행
      const result = eventBus.emit('FONT_SIZE_CHANGED', { fontSize: 3 })

      // Then: 정상적으로 실행됨
      expect(result).toBe(true)
      expect(execCommandSpy).toHaveBeenCalled()

      execCommandSpy.mockRestore()
    })

    it('checkComposition이 false일 때 글자 크기 변경을 허용해야 함', async () => {
      // Given: checkComposition이 비활성화된 플러그인
      pluginManager.destroyAll()

      const customPlugin = createFontSizePlugin({
        checkComposition: false,
      })

      const newContext = {
        eventBus,
        selectionManager,
        config: {},
      }
      const newManager = new PluginManager(newContext)
      await newManager.register(customPlugin)

      const execCommandSpy = vi
        .spyOn(document, 'execCommand')
        .mockReturnValue(true)

      element.dispatchEvent(new CompositionEvent('compositionstart'))
      expect(selectionManager.getIsComposing()).toBe(true)

      // When: IME 조합 중에도 글자 크기 변경 실행
      const result = eventBus.emit('FONT_SIZE_CHANGED', { fontSize: 3 })

      // Then: 차단 없이 실행됨
      expect(result).toBe(true)
      expect(execCommandSpy).toHaveBeenCalled()

      execCommandSpy.mockRestore()
      newManager.destroyAll()
    })
  })

  describe('에러 처리 (예외 상황 대응)', () => {
    /**
     * Why: execCommand 실패 시에도 에디터가 안정적으로 동작해야 함
     * How: try-catch로 예외 처리 후 에러 로깅
     */

    beforeEach(async () => {
      await pluginManager.register(FontSizePlugin)
    })

    it('execCommand 에러를 안전하게 처리해야 함', () => {
      // Given: execCommand가 에러를 던지는 상태
      const consoleError = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {})

      vi.spyOn(document, 'execCommand').mockImplementation(() => {
        throw new Error('execCommand failed')
      })

      // When: 이벤트 발생
      const result = eventBus.emit('FONT_SIZE_CHANGED', { fontSize: 3 })

      // Then: 에러가 안전하게 처리됨
      expect(result).toBe(false)
      expect(consoleError).toHaveBeenCalledWith(
        'Failed to execute font size command:',
        expect.any(Error)
      )

      consoleError.mockRestore()
      vi.restoreAllMocks()
    })
  })

  describe('플러그인 생명주기 (초기화/정리)', () => {
    /**
     * Why: 플러그인 제거 시 이벤트 리스너가 정리되어야 메모리 누수 방지
     * How: `destroy()` 호출 시 등록된 리스너 제거 확인
     */

    it('destroy 시 정리를 수행해야 함', async () => {
      // Given: 등록된 플러그인
      await pluginManager.register(FontSizePlugin)

      const execCommandSpy = vi
        .spyOn(document, 'execCommand')
        .mockReturnValue(true)

      let result = eventBus.emit('FONT_SIZE_CHANGED', { fontSize: 3 })
      expect(result).toBe(true)
      expect(execCommandSpy).toHaveBeenCalledTimes(1)

      // When: 플러그인 정리
      pluginManager.destroyAll()

      // Then: 더 이상 이벤트에 반응하지 않음
      execCommandSpy.mockClear()
      result = eventBus.emit('FONT_SIZE_CHANGED', { fontSize: 3 })
      expect(execCommandSpy).not.toHaveBeenCalled()

      execCommandSpy.mockRestore()
    })
  })

  describe('커스텀 이벤트 이름 (이벤트 설정)', () => {
    /**
     * Why: 다른 이벤트 이름으로 플러그인을 사용할 수 있어야 함
     * How: `createFontSizePlugin({ eventName })` 옵션으로 커스텀 이벤트 설정
     */

    it('커스텀 이벤트 이름을 수신해야 함', async () => {
      // Given: 커스텀 이벤트 이름이 설정된 플러그인
      const customPlugin = createFontSizePlugin({
        eventName: 'MY_SIZE_EVENT',
      })
      await pluginManager.register(customPlugin)

      const execCommandSpy = vi
        .spyOn(document, 'execCommand')
        .mockReturnValue(true)

      // When: 커스텀 이벤트 발생
      const result = eventBus.emit('MY_SIZE_EVENT', { fontSize: 5 })

      // Then: 글자 크기 명령이 실행됨
      expect(result).toBe(true)
      expect(execCommandSpy).toHaveBeenCalledWith('fontSize', false, '5')

      execCommandSpy.mockRestore()
    })
  })

  describe('엣지 케이스 (경계 값 처리)', () => {
    /**
     * Why: 경계 값에서의 안정적인 동작 보장
     * How: 0, 음수, 매우 큰 값 등 경계 값 테스트
     */

    beforeEach(async () => {
      await pluginManager.register(FontSizePlugin)
    })

    it('fontSize: 0을 처리해야 함', () => {
      // Given: 범위 미만의 fontSize
      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})

      // When: fontSize: 0으로 이벤트 발생
      const result = eventBus.emit('FONT_SIZE_CHANGED', { fontSize: 0 })

      // Then: 차단됨
      expect(result).toBe(false)

      consoleWarn.mockRestore()
    })

    it('음수 fontSize를 처리해야 함', () => {
      // Given: 음수 fontSize
      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})

      // When: 음수 fontSize로 이벤트 발생
      const result = eventBus.emit('FONT_SIZE_CHANGED', { fontSize: -1 })

      // Then: 차단됨
      expect(result).toBe(false)

      consoleWarn.mockRestore()
    })

    it('매우 큰 fontSize를 처리해야 함', () => {
      // Given: 매우 큰 fontSize
      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})

      // When: 매우 큰 fontSize로 이벤트 발생
      const result = eventBus.emit('FONT_SIZE_CHANGED', { fontSize: 100 })

      // Then: 차단됨
      expect(result).toBe(false)

      consoleWarn.mockRestore()
    })
  })
})
