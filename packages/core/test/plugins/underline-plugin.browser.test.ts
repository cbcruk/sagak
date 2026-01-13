import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { EventBus } from '@/core/event-bus'
import { PluginManager } from '@/core/plugin-manager'
import { SelectionManager } from '@/core/selection-manager'
import {
  createUnderlinePlugin,
  UnderlinePlugin,
} from '@/plugins/underline-plugin'
import type { EditorContext } from '@/core/types'

describe('UnderlinePlugin (밑줄 텍스트 스타일 적용)', () => {
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

    it('UnderlinePlugin을 등록해야 함', async () => {
      // Given: 빈 PluginManager

      // When: UnderlinePlugin 등록
      await pluginManager.register(UnderlinePlugin)

      // Then: 플러그인이 등록됨
      expect(pluginManager.has('text-style:underline')).toBe(true)
      expect(pluginManager.size).toBe(1)
    })

    it('커스텀 옵션으로 플러그인을 생성해야 함', async () => {
      // Given: 커스텀 옵션이 적용된 플러그인
      const customPlugin = createUnderlinePlugin({
        eventName: 'CUSTOM_UNDERLINE',
        checkComposition: false,
      })

      // When: 커스텀 플러그인 등록
      await pluginManager.register(customPlugin)

      // Then: 동일한 이름으로 등록됨
      expect(pluginManager.has('text-style:underline')).toBe(true)
    })
  })

  describe('밑줄 명령 실행 (execCommand 호출)', () => {
    /**
     * Why: 사용자가 밑줄 버튼 클릭 시 선택된 텍스트에 밑줄 스타일 적용
     * How: `UNDERLINE_CLICKED` 이벤트 수신 → `execCommand('underline')` 실행
     */

    beforeEach(async () => {
      await pluginManager.register(UnderlinePlugin)
    })

    it('UNDERLINE_CLICKED 이벤트에서 밑줄 명령을 실행해야 함', () => {
      // Given: 텍스트가 선택된 상태
      const execCommandSpy = vi.spyOn(document, 'execCommand')
      const textNode = element.firstChild!.firstChild as Text
      const range = document.createRange()
      range.setStart(textNode, 0)
      range.setEnd(textNode, 5)

      const selection = window.getSelection()!
      selection.removeAllRanges()
      selection.addRange(range)

      // When: UNDERLINE_CLICKED 이벤트 발생
      const result = eventBus.emit('UNDERLINE_CLICKED')

      // Then: execCommand가 호출되고 성공 반환
      expect(result).toBe(true)
      expect(execCommandSpy).toHaveBeenCalledWith('underline', false)

      execCommandSpy.mockRestore()
    })

    it('밑줄 성공 후 STYLE_CHANGED 이벤트를 발생시켜야 함', () => {
      // Given: execCommand가 성공하는 상태
      vi.spyOn(document, 'execCommand').mockReturnValue(true)
      const styleChangedSpy = vi.fn()
      eventBus.on('STYLE_CHANGED', 'on', styleChangedSpy)

      // When: UNDERLINE_CLICKED 이벤트 발생
      eventBus.emit('UNDERLINE_CLICKED')

      // Then: STYLE_CHANGED 이벤트가 발생함
      expect(styleChangedSpy).toHaveBeenCalledWith({ style: 'underline' })

      vi.restoreAllMocks()
    })

    it('execCommand 실패 시 STYLE_CHANGED를 발생시키지 않아야 함', () => {
      // Given: execCommand가 실패하는 상태
      vi.spyOn(document, 'execCommand').mockReturnValue(false)
      const styleChangedSpy = vi.fn()
      eventBus.on('STYLE_CHANGED', 'on', styleChangedSpy)

      // When: UNDERLINE_CLICKED 이벤트 발생
      eventBus.emit('UNDERLINE_CLICKED')

      // Then: STYLE_CHANGED 이벤트가 발생하지 않음
      expect(styleChangedSpy).not.toHaveBeenCalled()

      vi.restoreAllMocks()
    })
  })

  describe('CJK/IME 입력 지원 (조합 문자 처리)', () => {
    /**
     * Why: 한글 등 조합 문자 입력 중 스타일 변경 시 입력이 깨질 수 있음
     * How: `SelectionManager.getIsComposing()`으로 조합 상태 확인 후 차단
     */

    beforeEach(async () => {
      await pluginManager.register(UnderlinePlugin)
    })

    it('IME 입력 중에는 밑줄을 차단해야 함', () => {
      // Given: IME 조합 중인 상태
      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const execCommandSpy = vi.spyOn(document, 'execCommand')

      element.dispatchEvent(new CompositionEvent('compositionstart'))
      expect(selectionManager.getIsComposing()).toBe(true)

      // When: 밑줄 명령 시도
      const result = eventBus.emit('UNDERLINE_CLICKED')

      // Then: BEFORE 단계에서 차단됨
      expect(result).toBe(false)
      expect(consoleWarn).toHaveBeenCalledWith(
        'Underline blocked: IME composition in progress'
      )
      expect(execCommandSpy).not.toHaveBeenCalled()

      consoleWarn.mockRestore()
      execCommandSpy.mockRestore()
    })

    it('조합 종료 후에는 밑줄을 허용해야 함', () => {
      // Given: IME 조합이 종료된 상태
      const execCommandSpy = vi
        .spyOn(document, 'execCommand')
        .mockReturnValue(true)

      element.dispatchEvent(new CompositionEvent('compositionstart'))
      element.dispatchEvent(new CompositionEvent('compositionend'))
      expect(selectionManager.getIsComposing()).toBe(false)

      // When: 밑줄 명령 실행
      const result = eventBus.emit('UNDERLINE_CLICKED')

      // Then: 정상적으로 실행됨
      expect(result).toBe(true)
      expect(execCommandSpy).toHaveBeenCalled()

      execCommandSpy.mockRestore()
    })

    it('checkComposition이 false일 때 밑줄을 허용해야 함', async () => {
      // Given: checkComposition이 비활성화된 플러그인
      pluginManager.destroyAll()

      const customPlugin = createUnderlinePlugin({
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

      // When: IME 조합 중에도 밑줄 명령 실행
      const result = eventBus.emit('UNDERLINE_CLICKED')

      // Then: 차단 없이 실행됨
      expect(result).toBe(true)
      expect(execCommandSpy).toHaveBeenCalled()

      execCommandSpy.mockRestore()
      newManager.destroyAll()
    })
  })

  describe('이벤트 단계 (3단계 실행 흐름)', () => {
    /**
     * Why: 이벤트 실행 전/중/후 처리를 위한 3단계 흐름 검증
     * How: `EventBus`의 BEFORE/ON/AFTER 단계 순차 실행 확인
     */

    beforeEach(async () => {
      await pluginManager.register(UnderlinePlugin)
    })

    it('3단계(BEFORE/ON/AFTER)를 모두 실행해야 함', () => {
      // Given: 각 단계별 리스너 등록
      vi.spyOn(document, 'execCommand').mockReturnValue(true)

      const beforeSpy = vi.fn().mockReturnValue(true)
      const onSpy = vi.fn().mockReturnValue(true)
      const afterSpy = vi.fn()

      eventBus.on('UNDERLINE_CLICKED', 'before', beforeSpy)
      eventBus.on('UNDERLINE_CLICKED', 'on', onSpy)
      eventBus.on('UNDERLINE_CLICKED', 'after', afterSpy)

      // When: 이벤트 발생
      eventBus.emit('UNDERLINE_CLICKED')

      // Then: 모든 단계가 실행됨
      expect(beforeSpy).toHaveBeenCalled()
      expect(onSpy).toHaveBeenCalled()
      expect(afterSpy).toHaveBeenCalled()

      vi.restoreAllMocks()
    })

    it('차단 시 BEFORE 단계에서 중단해야 함', () => {
      // Given: BEFORE 단계에서 차단되는 상태 (IME 조합 중)
      const onSpy = vi.fn()
      const afterSpy = vi.fn()

      eventBus.on('UNDERLINE_CLICKED', 'on', onSpy)
      eventBus.on('UNDERLINE_CLICKED', 'after', afterSpy)

      element.dispatchEvent(new CompositionEvent('compositionstart'))

      // When: 이벤트 발생
      const result = eventBus.emit('UNDERLINE_CLICKED')

      // Then: ON/AFTER 단계가 실행되지 않음
      expect(result).toBe(false)
      expect(onSpy).not.toHaveBeenCalled()
      expect(afterSpy).not.toHaveBeenCalled()
    })
  })

  describe('커스텀 이벤트 이름 (이벤트 설정)', () => {
    /**
     * Why: 다른 이벤트 이름으로 플러그인을 사용할 수 있어야 함
     * How: `createUnderlinePlugin({ eventName })` 옵션으로 커스텀 이벤트 설정
     */

    it('커스텀 이벤트 이름을 수신해야 함', async () => {
      // Given: 커스텀 이벤트 이름이 설정된 플러그인
      const customPlugin = createUnderlinePlugin({
        eventName: 'MY_UNDERLINE_EVENT',
      })
      await pluginManager.register(customPlugin)

      const execCommandSpy = vi
        .spyOn(document, 'execCommand')
        .mockReturnValue(true)

      // When: 커스텀 이벤트 발생
      const result = eventBus.emit('MY_UNDERLINE_EVENT')

      // Then: 밑줄 명령이 실행됨
      expect(result).toBe(true)
      expect(execCommandSpy).toHaveBeenCalledWith('underline', false)

      execCommandSpy.mockRestore()
    })

    it('커스텀 이름 사용 시 기본 이벤트에 반응하지 않아야 함', async () => {
      // Given: 커스텀 이벤트 이름이 설정된 플러그인
      const customPlugin = createUnderlinePlugin({
        eventName: 'MY_UNDERLINE_EVENT',
      })
      await pluginManager.register(customPlugin)

      const execCommandSpy = vi.spyOn(document, 'execCommand')

      // When: 기본 이벤트 발생
      eventBus.emit('UNDERLINE_CLICKED')

      // Then: 반응하지 않음
      expect(execCommandSpy).not.toHaveBeenCalled()

      execCommandSpy.mockRestore()
    })
  })

  describe('에러 처리 (예외 상황 대응)', () => {
    /**
     * Why: execCommand 실패 시에도 에디터가 안정적으로 동작해야 함
     * How: try-catch로 예외 처리 후 에러 로깅
     */

    beforeEach(async () => {
      await pluginManager.register(UnderlinePlugin)
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
      const result = eventBus.emit('UNDERLINE_CLICKED')

      // Then: 에러가 안전하게 처리됨
      expect(result).toBe(false)
      expect(consoleError).toHaveBeenCalledWith(
        'Failed to execute underline command:',
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
      await pluginManager.register(UnderlinePlugin)

      const execCommandSpy = vi
        .spyOn(document, 'execCommand')
        .mockReturnValue(true)

      let result = eventBus.emit('UNDERLINE_CLICKED')
      expect(result).toBe(true)
      expect(execCommandSpy).toHaveBeenCalledTimes(1)

      // When: 플러그인 정리
      pluginManager.destroyAll()

      // Then: 더 이상 이벤트에 반응하지 않음
      execCommandSpy.mockClear()
      result = eventBus.emit('UNDERLINE_CLICKED')
      expect(execCommandSpy).not.toHaveBeenCalled()

      execCommandSpy.mockRestore()
    })

    it('destroy 후 재등록을 허용해야 함', async () => {
      // Given: 정리된 플러그인
      await pluginManager.register(UnderlinePlugin)
      pluginManager.destroyAll()

      const newContext = {
        eventBus: new EventBus(),
        selectionManager,
        config: {},
      }
      const newManager = new PluginManager(newContext)

      // When: 재등록 시도
      await expect(newManager.register(UnderlinePlugin)).resolves.not.toThrow()

      // Then: 정상적으로 등록됨
      expect(newManager.has('text-style:underline')).toBe(true)

      newManager.destroyAll()
    })
  })

  describe('SelectionManager 통합 (선택 영역 연동)', () => {
    /**
     * Why: 저장/복원된 선택 영역에서도 스타일이 적용되어야 함
     * How: `SelectionManager`와 연동하여 선택 영역 관리
     */

    beforeEach(async () => {
      await pluginManager.register(UnderlinePlugin)
    })

    it('context에 SelectionManager가 없어도 실행해야 함', async () => {
      // Given: SelectionManager 없는 컨텍스트
      pluginManager.destroyAll()

      const contextWithoutSM = {
        eventBus,
        config: {},
      }
      const managerWithoutSM = new PluginManager(contextWithoutSM)
      await managerWithoutSM.register(UnderlinePlugin)

      const execCommandSpy = vi
        .spyOn(document, 'execCommand')
        .mockReturnValue(true)

      // When: 이벤트 발생
      const result = eventBus.emit('UNDERLINE_CLICKED')

      // Then: 정상적으로 실행됨 (IME 체크 건너뜀)
      expect(result).toBe(true)
      expect(execCommandSpy).toHaveBeenCalled()

      execCommandSpy.mockRestore()
      managerWithoutSM.destroyAll()
    })
  })
})
