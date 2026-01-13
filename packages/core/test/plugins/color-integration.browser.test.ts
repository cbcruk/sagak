import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { EventBus } from '@/core/event-bus'
import { PluginManager } from '@/core/plugin-manager'
import { SelectionManager } from '@/core/selection-manager'
import { TextColorPlugin } from '@/plugins/text-color-plugin'
import { BackgroundColorPlugin } from '@/plugins/background-color-plugin'
import type { EditorContext } from '@/core/types'

describe('색상 플러그인 통합 (텍스트와 배경 색상 조합)', () => {
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
     * Why: 텍스트 색상과 배경 색상 플러그인을 함께 사용할 수 있어야 함
     * How: `PluginManager.register()`로 두 플러그인을 등록하고 `has()`로 확인
     */

    it('두 색상 플러그인을 모두 등록해야 함', async () => {
      // Given: 플러그인 매니저 준비

      // When: 텍스트 색상과 배경 색상 플러그인 등록
      await pluginManager.register(TextColorPlugin)
      await pluginManager.register(BackgroundColorPlugin)

      // Then: 두 플러그인이 모두 등록되어야 함
      expect(pluginManager.has('text-style:text-color')).toBe(true)
      expect(pluginManager.has('text-style:background-color')).toBe(true)
      expect(pluginManager.size).toBe(2)
    })
  })

  describe('복합 색상 변경 (텍스트와 배경 조합)', () => {
    /**
     * Why: 사용자가 텍스트 색상과 배경 색상을 독립적으로 또는 함께 변경할 수 있어야 함
     * How: `EventBus.emit()`으로 색상 변경 이벤트를 발생시키고 `execCommand` 호출 검증
     */

    beforeEach(async () => {
      // Given: 색상 관련 플러그인 등록
      await pluginManager.register(TextColorPlugin)
      await pluginManager.register(BackgroundColorPlugin)
    })

    it('텍스트 색상과 배경 색상을 순차적으로 적용해야 함', () => {
      // Given: execCommand Mock 설정
      const execCommandSpy = vi
        .spyOn(document, 'execCommand')
        .mockReturnValue(true)

      // When: 텍스트 색상 변경 후 배경 색상 변경
      eventBus.emit('TEXT_COLOR_CHANGED', { color: '#FF0000' })
      eventBus.emit('BACKGROUND_COLOR_CHANGED', { color: '#FFFF00' })

      // Then: 각 변경에 대해 execCommand가 올바른 순서로 호출되어야 함
      expect(execCommandSpy).toHaveBeenNthCalledWith(
        1,
        'foreColor',
        false,
        '#FF0000'
      )
      expect(execCommandSpy).toHaveBeenNthCalledWith(
        2,
        'backColor',
        false,
        '#FFFF00'
      )
      expect(execCommandSpy).toHaveBeenCalledTimes(2)

      execCommandSpy.mockRestore()
    })

    it('개별 STYLE_CHANGED 이벤트를 발생시켜야 함', () => {
      // Given: execCommand Mock과 STYLE_CHANGED 리스너 설정
      vi.spyOn(document, 'execCommand').mockReturnValue(true)

      const styleChangedSpy = vi.fn()
      eventBus.on('STYLE_CHANGED', 'on', styleChangedSpy)

      // When: 텍스트 색상과 배경 색상 변경
      eventBus.emit('TEXT_COLOR_CHANGED', { color: '#0000FF' })
      eventBus.emit('BACKGROUND_COLOR_CHANGED', { color: '#00FFFF' })

      // Then: STYLE_CHANGED 이벤트가 각 변경에 대해 발생해야 함
      expect(styleChangedSpy).toHaveBeenCalledTimes(2)
      expect(styleChangedSpy).toHaveBeenNthCalledWith(1, {
        style: 'textColor',
        value: '#0000FF',
      })
      expect(styleChangedSpy).toHaveBeenNthCalledWith(2, {
        style: 'backgroundColor',
        value: '#00FFFF',
      })

      vi.restoreAllMocks()
    })

    it('여러 색상 변경을 처리해야 함', () => {
      // Given: execCommand Mock 설정
      const execCommandSpy = vi
        .spyOn(document, 'execCommand')
        .mockReturnValue(true)

      // When: 텍스트 색상과 배경 색상을 교차로 여러 번 변경
      eventBus.emit('TEXT_COLOR_CHANGED', { color: '#FF0000' })
      eventBus.emit('BACKGROUND_COLOR_CHANGED', { color: '#FFFF00' })
      eventBus.emit('TEXT_COLOR_CHANGED', { color: '#0000FF' })
      eventBus.emit('BACKGROUND_COLOR_CHANGED', { color: '#00FF00' })

      // Then: 4번의 execCommand가 호출되어야 함
      expect(execCommandSpy).toHaveBeenCalledTimes(4)

      execCommandSpy.mockRestore()
    })

    it('다양한 색상 형식을 함께 지원해야 함', () => {
      // Given: execCommand Mock 설정
      const execCommandSpy = vi
        .spyOn(document, 'execCommand')
        .mockReturnValue(true)

      // When: Hex, RGB, 색상 이름 등 다양한 형식 사용
      eventBus.emit('TEXT_COLOR_CHANGED', { color: '#FF0000' })
      eventBus.emit('BACKGROUND_COLOR_CHANGED', { color: 'rgb(255, 255, 0)' })

      eventBus.emit('TEXT_COLOR_CHANGED', { color: 'blue' })
      eventBus.emit('BACKGROUND_COLOR_CHANGED', { color: 'yellow' })

      // Then: 모든 형식이 처리되어야 함
      expect(execCommandSpy).toHaveBeenCalledTimes(4)

      execCommandSpy.mockRestore()
    })
  })

  describe('IME 조합 차단 (입력 중 스타일 차단)', () => {
    /**
     * Why: CJK 입력 중 색상 변경 시 문자 조합이 깨지는 것을 방지
     * How: `compositionstart` 이벤트로 조합 상태를 시뮬레이션하고 색상 명령 차단 확인
     */

    beforeEach(async () => {
      // Given: 색상 관련 플러그인 등록
      await pluginManager.register(TextColorPlugin)
      await pluginManager.register(BackgroundColorPlugin)
    })

    it('조합 중 두 색상 명령을 모두 차단해야 함', () => {
      // Given: console.warn Mock과 조합 시작
      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const execCommandSpy = vi.spyOn(document, 'execCommand')

      element.dispatchEvent(new CompositionEvent('compositionstart'))
      expect(selectionManager.getIsComposing()).toBe(true)

      // When: 조합 중 색상 변경 시도
      const textColorResult = eventBus.emit('TEXT_COLOR_CHANGED', {
        color: '#FF0000',
      })
      const bgColorResult = eventBus.emit('BACKGROUND_COLOR_CHANGED', {
        color: '#FFFF00',
      })

      // Then: 두 명령 모두 차단되어야 함
      expect(textColorResult).toBe(false)
      expect(bgColorResult).toBe(false)
      expect(execCommandSpy).not.toHaveBeenCalled()
      expect(consoleWarn).toHaveBeenCalledTimes(2)

      consoleWarn.mockRestore()
      execCommandSpy.mockRestore()
    })

    it('조합 종료 후 두 명령을 모두 허용해야 함', () => {
      // Given: execCommand Mock과 조합 시작 후 종료
      const execCommandSpy = vi
        .spyOn(document, 'execCommand')
        .mockReturnValue(true)

      element.dispatchEvent(new CompositionEvent('compositionstart'))
      element.dispatchEvent(new CompositionEvent('compositionend'))
      expect(selectionManager.getIsComposing()).toBe(false)

      // When: 조합 종료 후 색상 변경
      const textColorResult = eventBus.emit('TEXT_COLOR_CHANGED', {
        color: '#FF0000',
      })
      const bgColorResult = eventBus.emit('BACKGROUND_COLOR_CHANGED', {
        color: '#FFFF00',
      })

      // Then: 두 명령 모두 성공해야 함
      expect(textColorResult).toBe(true)
      expect(bgColorResult).toBe(true)
      expect(execCommandSpy).toHaveBeenCalledTimes(2)

      execCommandSpy.mockRestore()
    })
  })

  describe('에러 처리 (예외 상황 대응)', () => {
    /**
     * Why: 한 플러그인의 에러가 다른 플러그인에 영향을 주지 않아야 함
     * How: `execCommand`가 선택적으로 실패하도록 Mock하고 독립적인 에러 처리 확인
     */

    beforeEach(async () => {
      // Given: 색상 관련 플러그인 등록
      await pluginManager.register(TextColorPlugin)
      await pluginManager.register(BackgroundColorPlugin)
    })

    it('에러를 독립적으로 처리해야 함', () => {
      // Given: foreColor만 실패하도록 Mock 설정
      const consoleError = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {})

      const execCommandSpy = vi
        .spyOn(document, 'execCommand')
        .mockImplementation((command) => {
          if (command === 'foreColor') throw new Error('Text color failed')
          if (command === 'backColor') return true
          return false
        })

      // When: 텍스트 색상과 배경 색상 변경
      eventBus.emit('TEXT_COLOR_CHANGED', { color: '#FF0000' })
      eventBus.emit('BACKGROUND_COLOR_CHANGED', { color: '#FFFF00' })

      // Then: foreColor 에러만 기록되고 backColor는 성공해야 함
      expect(consoleError).toHaveBeenCalledTimes(1)
      expect(execCommandSpy).toHaveBeenCalledTimes(2)

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

      // When: 텍스트 색상 실패 후 배경 색상 변경
      eventBus.emit('TEXT_COLOR_CHANGED', { color: '#FF0000' })
      expect(consoleError).toHaveBeenCalledTimes(1)

      eventBus.emit('BACKGROUND_COLOR_CHANGED', { color: '#FFFF00' })

      // Then: 배경 색상은 정상 동작해야 함
      expect(execCommandSpy).toHaveBeenCalledTimes(2)

      consoleError.mockRestore()
      execCommandSpy.mockRestore()
    })
  })

  describe('검증 (입력값 확인)', () => {
    /**
     * Why: 잘못된 색상 데이터로 인한 오류를 방지해야 함
     * How: 유효하지 않은 색상 데이터로 이벤트를 발생시키고 검증 로직 확인
     */

    beforeEach(async () => {
      // Given: 색상 관련 플러그인 등록
      await pluginManager.register(TextColorPlugin)
      await pluginManager.register(BackgroundColorPlugin)
    })

    it('텍스트 색상과 배경 색상을 독립적으로 검증해야 함', () => {
      // Given: console.warn Mock과 execCommand Mock 설정
      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const execCommandSpy = vi
        .spyOn(document, 'execCommand')
        .mockReturnValue(true)

      // When: 유효한 텍스트 색상, 유효하지 않은 배경 색상
      eventBus.emit('TEXT_COLOR_CHANGED', { color: '#FF0000' })
      eventBus.emit('BACKGROUND_COLOR_CHANGED', { color: '#GG0000' })

      // Then: 텍스트 색상만 적용되고 배경 색상은 경고 발생
      expect(execCommandSpy).toHaveBeenCalledTimes(1)
      expect(consoleWarn).toHaveBeenCalledTimes(1)

      consoleWarn.mockRestore()
      execCommandSpy.mockRestore()
    })

    it('데이터 누락 시 둘 다 차단해야 함', () => {
      // Given: console.warn Mock 설정
      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const execCommandSpy = vi.spyOn(document, 'execCommand')

      // When: 빈 데이터로 이벤트 발생
      eventBus.emit('TEXT_COLOR_CHANGED', {})
      eventBus.emit('BACKGROUND_COLOR_CHANGED', {})

      // Then: 두 명령 모두 차단되고 경고 발생
      expect(execCommandSpy).not.toHaveBeenCalled()
      expect(consoleWarn).toHaveBeenCalledTimes(2)

      consoleWarn.mockRestore()
      execCommandSpy.mockRestore()
    })

    it('두 플러그인 모두 hex 색상 형식을 검증해야 함', () => {
      // Given: execCommand Mock 설정
      const execCommandSpy = vi
        .spyOn(document, 'execCommand')
        .mockReturnValue(true)

      // When: 긴 hex와 짧은 hex 형식 사용
      eventBus.emit('TEXT_COLOR_CHANGED', { color: '#FF0000' })
      eventBus.emit('BACKGROUND_COLOR_CHANGED', { color: '#FFFF00' })

      eventBus.emit('TEXT_COLOR_CHANGED', { color: '#F00' })
      eventBus.emit('BACKGROUND_COLOR_CHANGED', { color: '#FF0' })

      // Then: 모든 형식이 처리되어야 함
      expect(execCommandSpy).toHaveBeenCalledTimes(4)

      execCommandSpy.mockRestore()
    })
  })

  describe('실제 시나리오 (사용자 동작 시뮬레이션)', () => {
    /**
     * Why: 실제 사용자의 색상 변경 패턴을 시뮬레이션하여 통합 동작 확인
     * How: 색상 선택기, 프리셋, 강조 효과 등 실제 시나리오 재현
     */

    beforeEach(async () => {
      // Given: 색상 관련 플러그인 등록
      await pluginManager.register(TextColorPlugin)
      await pluginManager.register(BackgroundColorPlugin)
    })

    it('색상 선택기 선택을 처리해야 함', () => {
      // Given: execCommand Mock 설정
      const execCommandSpy = vi
        .spyOn(document, 'execCommand')
        .mockReturnValue(true)

      // When: 사용자가 색상 선택기에서 텍스트 색상과 배경 색상 선택
      eventBus.emit('TEXT_COLOR_CHANGED', { color: '#FF0000' })
      eventBus.emit('BACKGROUND_COLOR_CHANGED', { color: '#FFFF00' })

      // Then: 두 명령이 올바르게 실행되어야 함
      expect(execCommandSpy).toHaveBeenCalledTimes(2)
      expect(execCommandSpy).toHaveBeenNthCalledWith(
        1,
        'foreColor',
        false,
        '#FF0000'
      )
      expect(execCommandSpy).toHaveBeenNthCalledWith(
        2,
        'backColor',
        false,
        '#FFFF00'
      )

      execCommandSpy.mockRestore()
    })

    it('프리셋 색상 조합을 처리해야 함', () => {
      // Given: execCommand Mock 설정
      const execCommandSpy = vi
        .spyOn(document, 'execCommand')
        .mockReturnValue(true)

      // When: 경고 프리셋(빨강/노랑) 적용 후 정보 프리셋(파랑/청록) 적용
      eventBus.emit('TEXT_COLOR_CHANGED', { color: '#FF0000' })
      eventBus.emit('BACKGROUND_COLOR_CHANGED', { color: '#FFFF00' })

      eventBus.emit('TEXT_COLOR_CHANGED', { color: '#0000FF' })
      eventBus.emit('BACKGROUND_COLOR_CHANGED', { color: '#00FFFF' })

      // Then: 4번의 execCommand가 호출되어야 함
      expect(execCommandSpy).toHaveBeenCalledTimes(4)

      execCommandSpy.mockRestore()
    })

    it('강조 효과(배경 색상만)를 처리해야 함', () => {
      // Given: execCommand Mock 설정
      const execCommandSpy = vi
        .spyOn(document, 'execCommand')
        .mockReturnValue(true)

      // When: 사용자가 배경 색상만 변경하여 텍스트 강조
      eventBus.emit('BACKGROUND_COLOR_CHANGED', { color: '#FFFF00' })
      eventBus.emit('BACKGROUND_COLOR_CHANGED', { color: '#00FFFF' })

      // Then: 배경 색상 명령만 실행되어야 함
      expect(execCommandSpy).toHaveBeenCalledTimes(2)
      expect(execCommandSpy).toHaveBeenNthCalledWith(
        1,
        'backColor',
        false,
        '#FFFF00'
      )
      expect(execCommandSpy).toHaveBeenNthCalledWith(
        2,
        'backColor',
        false,
        '#00FFFF'
      )

      execCommandSpy.mockRestore()
    })

    it('빠른 색상 변경을 처리해야 함', () => {
      // Given: execCommand Mock 설정
      const execCommandSpy = vi
        .spyOn(document, 'execCommand')
        .mockReturnValue(true)

      // When: 사용자가 여러 색상을 빠르게 시도
      eventBus.emit('TEXT_COLOR_CHANGED', { color: '#FF0000' })
      eventBus.emit('TEXT_COLOR_CHANGED', { color: '#00FF00' })
      eventBus.emit('TEXT_COLOR_CHANGED', { color: '#0000FF' })

      eventBus.emit('BACKGROUND_COLOR_CHANGED', { color: '#FFFF00' })
      eventBus.emit('BACKGROUND_COLOR_CHANGED', { color: '#FF00FF' })

      // Then: 모든 변경이 처리되어야 함
      expect(execCommandSpy).toHaveBeenCalledTimes(5)

      execCommandSpy.mockRestore()
    })

    it('색상 제거(투명/기본값)를 처리해야 함', () => {
      // Given: execCommand Mock 설정
      const execCommandSpy = vi
        .spyOn(document, 'execCommand')
        .mockReturnValue(true)

      // When: 색상 적용 후 투명으로 변경하여 제거
      eventBus.emit('TEXT_COLOR_CHANGED', { color: '#FF0000' })
      eventBus.emit('BACKGROUND_COLOR_CHANGED', { color: '#FFFF00' })

      eventBus.emit('TEXT_COLOR_CHANGED', { color: 'transparent' })
      eventBus.emit('BACKGROUND_COLOR_CHANGED', { color: 'transparent' })

      // Then: 4번의 execCommand가 호출되어야 함
      expect(execCommandSpy).toHaveBeenCalledTimes(4)

      execCommandSpy.mockRestore()
    })

    it('접근성을 위한 색상 이름을 처리해야 함', () => {
      // Given: execCommand Mock 설정
      const execCommandSpy = vi
        .spyOn(document, 'execCommand')
        .mockReturnValue(true)

      // When: 의미있는 색상 이름 사용
      eventBus.emit('TEXT_COLOR_CHANGED', { color: 'red' })
      eventBus.emit('BACKGROUND_COLOR_CHANGED', { color: 'yellow' })

      eventBus.emit('TEXT_COLOR_CHANGED', { color: 'blue' })
      eventBus.emit('BACKGROUND_COLOR_CHANGED', { color: 'white' })

      // Then: 모든 색상 이름이 처리되어야 함
      expect(execCommandSpy).toHaveBeenCalledTimes(4)

      execCommandSpy.mockRestore()
    })
  })

  describe('플러그인 생명주기 (초기화/정리)', () => {
    /**
     * Why: 플러그인이 올바르게 정리되어 메모리 누수를 방지해야 함
     * How: `PluginManager.destroyAll()` 및 `remove()`로 정리 후 이벤트 미반응 확인
     */

    it('두 플러그인을 함께 정리해야 함', async () => {
      // Given: 색상 관련 플러그인 등록
      await pluginManager.register(TextColorPlugin)
      await pluginManager.register(BackgroundColorPlugin)

      expect(pluginManager.size).toBe(2)

      // When: 모든 플러그인 정리
      pluginManager.destroyAll()

      // Then: 모든 플러그인이 제거되어야 함
      expect(pluginManager.size).toBe(0)
    })

    it('정리 후 이벤트에 반응하지 않아야 함', async () => {
      // Given: 색상 관련 플러그인 등록 후 정리
      await pluginManager.register(TextColorPlugin)
      await pluginManager.register(BackgroundColorPlugin)

      const execCommandSpy = vi
        .spyOn(document, 'execCommand')
        .mockReturnValue(true)

      pluginManager.destroyAll()

      // When: 정리 후 색상 변경 이벤트 발생
      eventBus.emit('TEXT_COLOR_CHANGED', { color: '#FF0000' })
      eventBus.emit('BACKGROUND_COLOR_CHANGED', { color: '#FFFF00' })

      // Then: execCommand가 호출되지 않아야 함
      expect(execCommandSpy).not.toHaveBeenCalled()

      execCommandSpy.mockRestore()
    })

    it('플러그인을 독립적으로 제거해야 함', async () => {
      // Given: 색상 관련 플러그인 등록 후 execCommand Mock 설정
      await pluginManager.register(TextColorPlugin)
      await pluginManager.register(BackgroundColorPlugin)

      const execCommandSpy = vi
        .spyOn(document, 'execCommand')
        .mockReturnValue(true)

      // When: 텍스트 색상 플러그인만 제거
      pluginManager.remove('text-style:text-color')

      eventBus.emit('TEXT_COLOR_CHANGED', { color: '#FF0000' })
      eventBus.emit('BACKGROUND_COLOR_CHANGED', { color: '#FFFF00' })

      // Then: 배경 색상만 동작해야 함
      expect(execCommandSpy).not.toHaveBeenCalledWith(
        'foreColor',
        false,
        '#FF0000'
      )
      expect(execCommandSpy).toHaveBeenCalledTimes(1)

      execCommandSpy.mockRestore()
    })
  })
})
