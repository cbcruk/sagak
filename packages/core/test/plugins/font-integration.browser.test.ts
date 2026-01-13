import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { EventBus } from '@/core/event-bus'
import { PluginManager } from '@/core/plugin-manager'
import { SelectionManager } from '@/core/selection-manager'
import { FontFamilyPlugin } from '@/plugins/font-family-plugin'
import { FontSizePlugin } from '@/plugins/font-size-plugin'
import type { EditorContext } from '@/core/types'

describe('글꼴 플러그인 통합 (글꼴과 크기 조합)', () => {
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
     * Why: 글꼴 패밀리와 크기 플러그인을 함께 사용할 수 있어야 함
     * How: `PluginManager.register()`로 두 플러그인을 등록하고 `has()`로 확인
     */

    it('두 글꼴 플러그인을 모두 등록해야 함', async () => {
      // Given: 플러그인 매니저 준비

      // When: 글꼴 패밀리와 크기 플러그인 등록
      await pluginManager.register(FontFamilyPlugin)
      await pluginManager.register(FontSizePlugin)

      // Then: 두 플러그인이 모두 등록되어야 함
      expect(pluginManager.has('text-style:font-family')).toBe(true)
      expect(pluginManager.has('text-style:font-size')).toBe(true)
      expect(pluginManager.size).toBe(2)
    })
  })

  describe('복합 글꼴 변경 (글꼴과 크기 조합)', () => {
    /**
     * Why: 사용자가 글꼴 패밀리와 크기를 독립적으로 또는 함께 변경할 수 있어야 함
     * How: `EventBus.emit()`으로 글꼴 변경 이벤트를 발생시키고 `execCommand` 호출 검증
     */

    beforeEach(async () => {
      // Given: 글꼴 관련 플러그인 등록
      await pluginManager.register(FontFamilyPlugin)
      await pluginManager.register(FontSizePlugin)
    })

    it('글꼴과 크기를 순차적으로 적용해야 함', () => {
      // Given: execCommand Mock 설정
      const execCommandSpy = vi
        .spyOn(document, 'execCommand')
        .mockReturnValue(true)

      // When: 글꼴 패밀리 변경 후 크기 변경
      eventBus.emit('FONT_FAMILY_CHANGED', { fontFamily: 'Arial' })
      eventBus.emit('FONT_SIZE_CHANGED', { fontSize: 5 })

      // Then: 각 변경에 대해 execCommand가 올바른 순서로 호출되어야 함
      expect(execCommandSpy).toHaveBeenNthCalledWith(
        1,
        'fontName',
        false,
        'Arial'
      )
      expect(execCommandSpy).toHaveBeenNthCalledWith(2, 'fontSize', false, '5')
      expect(execCommandSpy).toHaveBeenCalledTimes(2)

      execCommandSpy.mockRestore()
    })

    it('개별 STYLE_CHANGED 이벤트를 발생시켜야 함', () => {
      // Given: execCommand Mock과 STYLE_CHANGED 리스너 설정
      vi.spyOn(document, 'execCommand').mockReturnValue(true)

      const styleChangedSpy = vi.fn()
      eventBus.on('STYLE_CHANGED', 'on', styleChangedSpy)

      // When: 글꼴 패밀리와 크기 변경
      eventBus.emit('FONT_FAMILY_CHANGED', { fontFamily: 'Helvetica' })
      eventBus.emit('FONT_SIZE_CHANGED', { fontSize: 3 })

      // Then: STYLE_CHANGED 이벤트가 각 변경에 대해 발생해야 함
      expect(styleChangedSpy).toHaveBeenCalledTimes(2)
      expect(styleChangedSpy).toHaveBeenNthCalledWith(1, {
        style: 'fontFamily',
        value: 'Helvetica',
      })
      expect(styleChangedSpy).toHaveBeenNthCalledWith(2, {
        style: 'fontSize',
        value: 3,
      })

      vi.restoreAllMocks()
    })

    it('여러 글꼴 변경을 처리해야 함', () => {
      // Given: execCommand Mock 설정
      const execCommandSpy = vi
        .spyOn(document, 'execCommand')
        .mockReturnValue(true)

      // When: 글꼴 패밀리와 크기를 교차로 여러 번 변경
      eventBus.emit('FONT_FAMILY_CHANGED', { fontFamily: 'Arial' })
      eventBus.emit('FONT_SIZE_CHANGED', { fontSize: 4 })
      eventBus.emit('FONT_FAMILY_CHANGED', { fontFamily: 'Times New Roman' })
      eventBus.emit('FONT_SIZE_CHANGED', { fontSize: 6 })

      // Then: 4번의 execCommand가 호출되어야 함
      expect(execCommandSpy).toHaveBeenCalledTimes(4)

      execCommandSpy.mockRestore()
    })
  })

  describe('IME 조합 차단 (입력 중 스타일 차단)', () => {
    /**
     * Why: CJK 입력 중 글꼴 변경 시 문자 조합이 깨지는 것을 방지
     * How: `compositionstart` 이벤트로 조합 상태를 시뮬레이션하고 글꼴 명령 차단 확인
     */

    beforeEach(async () => {
      // Given: 글꼴 관련 플러그인 등록
      await pluginManager.register(FontFamilyPlugin)
      await pluginManager.register(FontSizePlugin)
    })

    it('조합 중 두 글꼴 명령을 모두 차단해야 함', () => {
      // Given: console.warn Mock과 조합 시작
      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const execCommandSpy = vi.spyOn(document, 'execCommand')

      element.dispatchEvent(new CompositionEvent('compositionstart'))
      expect(selectionManager.getIsComposing()).toBe(true)

      // When: 조합 중 글꼴 변경 시도
      const familyResult = eventBus.emit('FONT_FAMILY_CHANGED', {
        fontFamily: 'Arial',
      })
      const sizeResult = eventBus.emit('FONT_SIZE_CHANGED', { fontSize: 3 })

      // Then: 두 명령 모두 차단되어야 함
      expect(familyResult).toBe(false)
      expect(sizeResult).toBe(false)
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

      // When: 조합 종료 후 글꼴 변경
      const familyResult = eventBus.emit('FONT_FAMILY_CHANGED', {
        fontFamily: 'Arial',
      })
      const sizeResult = eventBus.emit('FONT_SIZE_CHANGED', { fontSize: 3 })

      // Then: 두 명령 모두 성공해야 함
      expect(familyResult).toBe(true)
      expect(sizeResult).toBe(true)
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
      // Given: 글꼴 관련 플러그인 등록
      await pluginManager.register(FontFamilyPlugin)
      await pluginManager.register(FontSizePlugin)
    })

    it('에러를 독립적으로 처리해야 함', () => {
      // Given: fontName만 실패하도록 Mock 설정
      const consoleError = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {})

      const execCommandSpy = vi
        .spyOn(document, 'execCommand')
        .mockImplementation((command) => {
          if (command === 'fontName') throw new Error('Font family failed')
          if (command === 'fontSize') return true
          return false
        })

      // When: 글꼴 패밀리와 크기 변경
      eventBus.emit('FONT_FAMILY_CHANGED', { fontFamily: 'Arial' })
      eventBus.emit('FONT_SIZE_CHANGED', { fontSize: 3 })

      // Then: fontName 에러만 기록되고 fontSize는 성공해야 함
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

      // When: 글꼴 패밀리 실패 후 크기 변경
      eventBus.emit('FONT_FAMILY_CHANGED', { fontFamily: 'Arial' })
      expect(consoleError).toHaveBeenCalledTimes(1)

      eventBus.emit('FONT_SIZE_CHANGED', { fontSize: 3 })

      // Then: 크기 변경은 정상 동작해야 함
      expect(execCommandSpy).toHaveBeenCalledTimes(2)

      consoleError.mockRestore()
      execCommandSpy.mockRestore()
    })
  })

  describe('검증 (입력값 확인)', () => {
    /**
     * Why: 잘못된 글꼴 데이터로 인한 오류를 방지해야 함
     * How: 유효하지 않은 데이터로 이벤트를 발생시키고 검증 로직 확인
     */

    beforeEach(async () => {
      // Given: 글꼴 관련 플러그인 등록
      await pluginManager.register(FontFamilyPlugin)
      await pluginManager.register(FontSizePlugin)
    })

    it('글꼴과 크기를 독립적으로 검증해야 함', () => {
      // Given: console.warn Mock과 execCommand Mock 설정
      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const execCommandSpy = vi
        .spyOn(document, 'execCommand')
        .mockReturnValue(true)

      // When: 유효한 글꼴 패밀리, 유효하지 않은 크기
      eventBus.emit('FONT_FAMILY_CHANGED', { fontFamily: 'Arial' })
      eventBus.emit('FONT_SIZE_CHANGED', { fontSize: 10 })

      // Then: 글꼴 패밀리만 적용되고 크기는 경고 발생
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
      eventBus.emit('FONT_FAMILY_CHANGED', {})
      eventBus.emit('FONT_SIZE_CHANGED', {})

      // Then: 두 명령 모두 차단되고 경고 발생
      expect(execCommandSpy).not.toHaveBeenCalled()
      expect(consoleWarn).toHaveBeenCalledTimes(2)

      consoleWarn.mockRestore()
      execCommandSpy.mockRestore()
    })
  })

  describe('실제 시나리오 (사용자 동작 시뮬레이션)', () => {
    /**
     * Why: 실제 사용자의 글꼴 변경 패턴을 시뮬레이션하여 통합 동작 확인
     * How: 드롭다운 선택, 프리셋 적용, 빠른 변경 등 실제 시나리오 재현
     */

    beforeEach(async () => {
      // Given: 글꼴 관련 플러그인 등록
      await pluginManager.register(FontFamilyPlugin)
      await pluginManager.register(FontSizePlugin)
    })

    it('글꼴 드롭다운 선택을 처리해야 함', () => {
      // Given: execCommand Mock 설정
      const execCommandSpy = vi
        .spyOn(document, 'execCommand')
        .mockReturnValue(true)

      // When: 사용자가 드롭다운에서 글꼴과 크기 선택
      eventBus.emit('FONT_FAMILY_CHANGED', { fontFamily: 'Verdana' })
      eventBus.emit('FONT_SIZE_CHANGED', { fontSize: 4 })

      // Then: 두 명령이 올바르게 실행되어야 함
      expect(execCommandSpy).toHaveBeenCalledTimes(2)
      expect(execCommandSpy).toHaveBeenNthCalledWith(
        1,
        'fontName',
        false,
        'Verdana'
      )
      expect(execCommandSpy).toHaveBeenNthCalledWith(2, 'fontSize', false, '4')

      execCommandSpy.mockRestore()
    })

    it('프리셋 조합을 처리해야 함', () => {
      // Given: execCommand Mock 설정
      const execCommandSpy = vi
        .spyOn(document, 'execCommand')
        .mockReturnValue(true)

      // When: 제목 프리셋(Arial, 큰 크기) 적용 후 본문 프리셋(Times New Roman, 보통 크기) 적용
      eventBus.emit('FONT_FAMILY_CHANGED', { fontFamily: 'Arial' })
      eventBus.emit('FONT_SIZE_CHANGED', { fontSize: 6 })

      eventBus.emit('FONT_FAMILY_CHANGED', {
        fontFamily: 'Times New Roman',
      })
      eventBus.emit('FONT_SIZE_CHANGED', { fontSize: 3 })

      // Then: 4번의 execCommand가 호출되어야 함
      expect(execCommandSpy).toHaveBeenCalledTimes(4)

      execCommandSpy.mockRestore()
    })

    it('빠른 글꼴 변경을 처리해야 함', () => {
      // Given: execCommand Mock 설정
      const execCommandSpy = vi
        .spyOn(document, 'execCommand')
        .mockReturnValue(true)

      // When: 사용자가 여러 글꼴을 빠르게 시도
      eventBus.emit('FONT_FAMILY_CHANGED', { fontFamily: 'Arial' })
      eventBus.emit('FONT_FAMILY_CHANGED', { fontFamily: 'Helvetica' })
      eventBus.emit('FONT_FAMILY_CHANGED', { fontFamily: 'Verdana' })

      // Then: 모든 변경이 처리되어야 함
      expect(execCommandSpy).toHaveBeenCalledTimes(3)

      execCommandSpy.mockRestore()
    })

    it('크기 단계 조절을 처리해야 함', () => {
      // Given: execCommand Mock 설정
      const execCommandSpy = vi
        .spyOn(document, 'execCommand')
        .mockReturnValue(true)

      // When: 사용자가 크기 증가 버튼을 여러 번 클릭
      for (let size = 3; size <= 6; size++) {
        eventBus.emit('FONT_SIZE_CHANGED', { fontSize: size })
      }

      // Then: 4번의 크기 변경이 처리되어야 함
      expect(execCommandSpy).toHaveBeenCalledTimes(4)

      execCommandSpy.mockRestore()
    })
  })

  describe('플러그인 생명주기 (초기화/정리)', () => {
    /**
     * Why: 플러그인이 올바르게 정리되어 메모리 누수를 방지해야 함
     * How: `PluginManager.destroyAll()`로 전체 정리 후 이벤트 미반응 확인
     */

    it('두 플러그인을 함께 정리해야 함', async () => {
      // Given: 글꼴 관련 플러그인 등록
      await pluginManager.register(FontFamilyPlugin)
      await pluginManager.register(FontSizePlugin)

      expect(pluginManager.size).toBe(2)

      // When: 모든 플러그인 정리
      pluginManager.destroyAll()

      // Then: 모든 플러그인이 제거되어야 함
      expect(pluginManager.size).toBe(0)
    })

    it('정리 후 이벤트에 반응하지 않아야 함', async () => {
      // Given: 글꼴 관련 플러그인 등록 후 정리
      await pluginManager.register(FontFamilyPlugin)
      await pluginManager.register(FontSizePlugin)

      const execCommandSpy = vi
        .spyOn(document, 'execCommand')
        .mockReturnValue(true)

      pluginManager.destroyAll()

      // When: 정리 후 글꼴 변경 이벤트 발생
      eventBus.emit('FONT_FAMILY_CHANGED', { fontFamily: 'Arial' })
      eventBus.emit('FONT_SIZE_CHANGED', { fontSize: 3 })

      // Then: execCommand가 호출되지 않아야 함
      expect(execCommandSpy).not.toHaveBeenCalled()

      execCommandSpy.mockRestore()
    })
  })
})
