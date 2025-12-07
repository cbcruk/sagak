import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { EventBus } from '../../core/src/event-bus'
import { PluginManager } from '../../core/src/plugin-manager'
import { SelectionManager } from '../../core/src/selection-manager'
import { createHeadingPlugin, HeadingPlugin } from '../src/heading-plugin'
import type { EditorContext } from '../../core/src/types'

describe('HeadingPlugin (제목 서식 적용)', () => {
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
     * Why: `HeadingPlugin`이 `PluginManager`에 정상적으로 등록되는지 확인
     * How: 기본 플러그인과 커스텀 옵션 플러그인을 등록한 후 `pluginManager.has()`로 검증
     */

    it('HeadingPlugin을 등록해야 함', async () => {
      // Given: 빈 PluginManager
      // When: HeadingPlugin 등록
      await pluginManager.register(HeadingPlugin)

      // Then: 플러그인이 등록되어야 함
      expect(pluginManager.has('paragraph:heading')).toBe(true)
      expect(pluginManager.size).toBe(1)
    })

    it('커스텀 옵션으로 플러그인을 생성해야 함', async () => {
      // Given: 커스텀 옵션을 가진 제목 플러그인
      const customPlugin = createHeadingPlugin({
        eventName: 'CUSTOM_HEADING',
        checkComposition: false,
        allowedLevels: [1, 2, 3],
      })

      // When: 커스텀 플러그인 등록
      await pluginManager.register(customPlugin)

      // Then: 플러그인이 등록되어야 함
      expect(pluginManager.has('paragraph:heading')).toBe(true)
    })
  })

  describe('제목 명령 실행 (formatBlock 호출)', () => {
    /**
     * Why: 실제 브라우저 환경에서 제목 명령이 올바르게 실행되는지 검증
     * How: 선택 영역을 생성한 후 `HEADING_CHANGED` 이벤트를 발행하여 `execCommand`로 `formatBlock` 호출 확인
     */

    beforeEach(async () => {
      await pluginManager.register(HeadingPlugin)
    })

    it('H1으로 formatBlock 명령을 실행해야 함', () => {
      // Given: execCommand spy와 선택 영역
      const execCommandSpy = vi.spyOn(document, 'execCommand')

      const textNode = element.firstChild!.firstChild as Text
      const range = document.createRange()
      range.setStart(textNode, 0)
      range.setEnd(textNode, 5)

      const selection = window.getSelection()!
      selection.removeAllRanges()
      selection.addRange(range)

      // When: H1 레벨 이벤트 발행
      const result = eventBus.emit('HEADING_CHANGED', { level: 1 })

      // Then: formatBlock '<h1>' 명령이 실행되어야 함
      expect(result).toBe(true)
      expect(execCommandSpy).toHaveBeenCalledWith('formatBlock', false, '<h1>')

      execCommandSpy.mockRestore()
    })

    it('H2로 formatBlock 명령을 실행해야 함', () => {
      // Given: execCommand spy와 선택 영역
      const execCommandSpy = vi.spyOn(document, 'execCommand')

      const textNode = element.firstChild!.firstChild as Text
      const range = document.createRange()
      range.setStart(textNode, 0)
      range.setEnd(textNode, 5)

      const selection = window.getSelection()!
      selection.removeAllRanges()
      selection.addRange(range)

      // When: H2 레벨 이벤트 발행
      const result = eventBus.emit('HEADING_CHANGED', { level: 2 })

      // Then: formatBlock '<h2>' 명령이 실행되어야 함
      expect(result).toBe(true)
      expect(execCommandSpy).toHaveBeenCalledWith('formatBlock', false, '<h2>')

      execCommandSpy.mockRestore()
    })

    it('H3으로 formatBlock 명령을 실행해야 함', () => {
      // Given: execCommand spy와 선택 영역
      const execCommandSpy = vi.spyOn(document, 'execCommand')

      const textNode = element.firstChild!.firstChild as Text
      const range = document.createRange()
      range.setStart(textNode, 0)
      range.setEnd(textNode, 5)

      const selection = window.getSelection()!
      selection.removeAllRanges()
      selection.addRange(range)

      // When: H3 레벨 이벤트 발행
      const result = eventBus.emit('HEADING_CHANGED', { level: 3 })

      // Then: formatBlock '<h3>' 명령이 실행되어야 함
      expect(result).toBe(true)
      expect(execCommandSpy).toHaveBeenCalledWith('formatBlock', false, '<h3>')

      execCommandSpy.mockRestore()
    })

    it('모든 제목 레벨(1-6)을 지원해야 함', () => {
      // Given: execCommand spy
      const execCommandSpy = vi
        .spyOn(document, 'execCommand')
        .mockReturnValue(true)

      // When: 모든 제목 레벨 이벤트 발행
      for (let level = 1; level <= 6; level++) {
        eventBus.emit('HEADING_CHANGED', { level })
        expect(execCommandSpy).toHaveBeenCalledWith(
          'formatBlock',
          false,
          `<h${level}>`
        )
      }

      // Then: 6번 호출되어야 함
      expect(execCommandSpy).toHaveBeenCalledTimes(6)

      execCommandSpy.mockRestore()
    })

    it('객체 래퍼 없이 직접 숫자를 받아야 함', () => {
      // Given: execCommand spy와 선택 영역
      const execCommandSpy = vi.spyOn(document, 'execCommand')

      const textNode = element.firstChild!.firstChild as Text
      const range = document.createRange()
      range.setStart(textNode, 0)
      range.setEnd(textNode, 5)

      const selection = window.getSelection()!
      selection.removeAllRanges()
      selection.addRange(range)

      // When: 숫자 형태로 레벨 이벤트 발행
      const result = eventBus.emit('HEADING_CHANGED', 2)

      // Then: formatBlock '<h2>' 명령이 실행되어야 함
      expect(result).toBe(true)
      expect(execCommandSpy).toHaveBeenCalledWith('formatBlock', false, '<h2>')

      execCommandSpy.mockRestore()
    })

    it('제목 변경 성공 후 STYLE_CHANGED 이벤트를 발생시켜야 함', () => {
      // Given: execCommand mock과 STYLE_CHANGED 리스너
      vi.spyOn(document, 'execCommand').mockReturnValue(true)

      const styleChangedSpy = vi.fn()
      eventBus.on('STYLE_CHANGED', 'on', styleChangedSpy)

      // When: 제목 변경 이벤트 발행
      eventBus.emit('HEADING_CHANGED', { level: 2 })

      // Then: STYLE_CHANGED 이벤트가 발행되어야 함
      expect(styleChangedSpy).toHaveBeenCalledWith({
        style: 'heading',
        value: 2,
      })

      vi.restoreAllMocks()
    })

    it('execCommand 실패 시 STYLE_CHANGED를 발생시키지 않아야 함', () => {
      // Given: 실패하는 execCommand mock
      vi.spyOn(document, 'execCommand').mockReturnValue(false)

      const styleChangedSpy = vi.fn()
      eventBus.on('STYLE_CHANGED', 'on', styleChangedSpy)

      // When: 제목 변경 이벤트 발행
      eventBus.emit('HEADING_CHANGED', { level: 1 })

      // Then: STYLE_CHANGED 이벤트가 발행되지 않아야 함
      expect(styleChangedSpy).not.toHaveBeenCalled()

      vi.restoreAllMocks()
    })
  })

  describe('레벨 검증 (유효한 레벨 확인)', () => {
    /**
     * Why: 잘못된 제목 레벨이 입력될 때 플러그인이 안전하게 차단하는지 검증
     * How: 유효하지 않은 레벨 값을 전달하여 경고 메시지 발생 및 `execCommand` 미실행 확인
     */

    beforeEach(async () => {
      await pluginManager.register(HeadingPlugin)
    })

    it('유효하지 않은 제목 레벨을 거부해야 함', () => {
      // Given: console.warn spy와 execCommand spy
      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const execCommandSpy = vi.spyOn(document, 'execCommand')

      // When: 유효하지 않은 레벨 전달 (0, 7, -1)
      eventBus.emit('HEADING_CHANGED', { level: 0 })
      eventBus.emit('HEADING_CHANGED', { level: 7 })
      eventBus.emit('HEADING_CHANGED', { level: -1 })

      // Then: 명령이 실행되지 않고 경고만 발생
      expect(execCommandSpy).not.toHaveBeenCalled()
      expect(consoleWarn).toHaveBeenCalledTimes(3)

      consoleWarn.mockRestore()
      execCommandSpy.mockRestore()
    })

    it('정수가 아닌 레벨을 거부해야 함', () => {
      // Given: console.warn spy와 execCommand spy
      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const execCommandSpy = vi.spyOn(document, 'execCommand')

      // When: 정수가 아닌 값 전달
      eventBus.emit('HEADING_CHANGED', { level: 1.5 })
      eventBus.emit('HEADING_CHANGED', { level: '2' })
      eventBus.emit('HEADING_CHANGED', { level: 'h1' })

      // Then: 명령이 실행되지 않고 경고만 발생
      expect(execCommandSpy).not.toHaveBeenCalled()
      expect(consoleWarn).toHaveBeenCalledTimes(3)

      consoleWarn.mockRestore()
      execCommandSpy.mockRestore()
    })

    it('레벨이 제공되지 않으면 차단해야 함', () => {
      // Given: console.warn spy와 execCommand spy
      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const execCommandSpy = vi.spyOn(document, 'execCommand')

      // When: 빈 객체 전달
      eventBus.emit('HEADING_CHANGED', {})

      // Then: 경고 메시지 발생 및 명령 미실행
      expect(execCommandSpy).not.toHaveBeenCalled()
      expect(consoleWarn).toHaveBeenCalledWith(
        'Heading blocked: Invalid heading level "[object Object]" (must be 1-6)'
      )

      consoleWarn.mockRestore()
      execCommandSpy.mockRestore()
    })

    it('data가 undefined면 차단해야 함', () => {
      // Given: console.warn spy와 execCommand spy
      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const execCommandSpy = vi.spyOn(document, 'execCommand')

      // When: undefined 전달
      eventBus.emit('HEADING_CHANGED')

      // Then: 경고 발생 및 명령 미실행
      expect(execCommandSpy).not.toHaveBeenCalled()
      expect(consoleWarn).toHaveBeenCalled()

      consoleWarn.mockRestore()
      execCommandSpy.mockRestore()
    })
  })

  describe('범위 검증 (min/max 레벨 확인)', () => {
    /**
     * Why: 커스텀 옵션으로 제목 레벨 범위를 제한할 수 있는지 검증
     * How: `minLevel`과 `maxLevel` 옵션으로 범위를 설정하고 허용/차단 여부 확인
     */

    it('최소/최대 레벨 범위를 준수해야 함', async () => {
      // Given: 레벨 범위가 제한된 커스텀 플러그인
      pluginManager.destroyAll()

      const customPlugin = createHeadingPlugin({
        minLevel: 2,
        maxLevel: 4,
      })

      const newContext = {
        eventBus,
        selectionManager,
        config: {},
      }
      const newManager = new PluginManager(newContext)
      await newManager.register(customPlugin)

      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const execCommandSpy = vi
        .spyOn(document, 'execCommand')
        .mockReturnValue(true)

      // When: 범위 내외 레벨 테스트
      eventBus.emit('HEADING_CHANGED', { level: 2 })
      eventBus.emit('HEADING_CHANGED', { level: 3 })
      eventBus.emit('HEADING_CHANGED', { level: 4 })
      eventBus.emit('HEADING_CHANGED', { level: 1 })
      eventBus.emit('HEADING_CHANGED', { level: 5 })

      // Then: 범위 내 레벨만 실행되어야 함
      expect(execCommandSpy).toHaveBeenCalledTimes(3)
      expect(consoleWarn).toHaveBeenCalledTimes(2)

      consoleWarn.mockRestore()
      execCommandSpy.mockRestore()
      newManager.destroyAll()
    })
  })

  describe('허용된 레벨 검증 (화이트리스트 확인)', () => {
    /**
     * Why: 커스텀 옵션으로 특정 레벨만 허용하도록 제한할 수 있는지 검증
     * How: `allowedLevels` 옵션으로 화이트리스트를 설정하고 허용/차단 여부 확인
     */

    it('허용 목록의 레벨을 허용해야 함', async () => {
      // Given: 특정 레벨만 허용하는 커스텀 플러그인
      pluginManager.destroyAll()

      const customPlugin = createHeadingPlugin({
        allowedLevels: [1, 2, 3],
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

      // When: 허용 목록에 있는 레벨 적용
      const result = eventBus.emit('HEADING_CHANGED', { level: 1 })

      // Then: 명령이 성공적으로 실행되어야 함
      expect(result).toBe(true)
      expect(execCommandSpy).toHaveBeenCalled()

      execCommandSpy.mockRestore()
      newManager.destroyAll()
    })

    it('허용 목록에 없는 레벨을 차단해야 함', async () => {
      // Given: 특정 레벨만 허용하는 커스텀 플러그인
      pluginManager.destroyAll()

      const customPlugin = createHeadingPlugin({
        allowedLevels: [1, 2, 3],
      })

      const newContext = {
        eventBus,
        selectionManager,
        config: {},
      }
      const newManager = new PluginManager(newContext)
      await newManager.register(customPlugin)

      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const execCommandSpy = vi.spyOn(document, 'execCommand')

      // When: 허용 목록에 없는 레벨 적용 시도
      const result = eventBus.emit('HEADING_CHANGED', { level: 4 })

      // Then: 경고 발생 및 명령 미실행
      expect(result).toBe(false)
      expect(consoleWarn).toHaveBeenCalledWith(
        'Heading blocked: Level 4 is not in allowed levels'
      )
      expect(execCommandSpy).not.toHaveBeenCalled()

      consoleWarn.mockRestore()
      execCommandSpy.mockRestore()
      newManager.destroyAll()
    })
  })

  describe('CJK/IME 입력 지원 (조합 문자 처리)', () => {
    /**
     * Why: IME 입력 중 제목 변경으로 인한 조합 문자 입력 방해 방지
     * How: `SelectionManager`의 조합 상태를 확인하여 IME 입력 중일 때 제목 변경 차단
     */

    beforeEach(async () => {
      await pluginManager.register(HeadingPlugin)
    })

    it('IME 입력 중에는 제목 변경을 차단해야 함', () => {
      // Given: IME 조합 중인 상태
      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const execCommandSpy = vi.spyOn(document, 'execCommand')

      element.dispatchEvent(new CompositionEvent('compositionstart'))
      expect(selectionManager.getIsComposing()).toBe(true)

      // When: 제목 변경 시도
      const result = eventBus.emit('HEADING_CHANGED', { level: 2 })

      // Then: 차단되고 경고 발생
      expect(result).toBe(false)
      expect(consoleWarn).toHaveBeenCalledWith(
        'Heading blocked: IME composition in progress'
      )
      expect(execCommandSpy).not.toHaveBeenCalled()

      consoleWarn.mockRestore()
      execCommandSpy.mockRestore()
    })

    it('조합 종료 후에는 제목 변경을 허용해야 함', () => {
      // Given: IME 조합 종료 상태
      const execCommandSpy = vi
        .spyOn(document, 'execCommand')
        .mockReturnValue(true)

      element.dispatchEvent(new CompositionEvent('compositionstart'))
      element.dispatchEvent(new CompositionEvent('compositionend'))
      expect(selectionManager.getIsComposing()).toBe(false)

      // When: 제목 변경 시도
      const result = eventBus.emit('HEADING_CHANGED', { level: 2 })

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
      await pluginManager.register(HeadingPlugin)
    })

    it('execCommand 에러를 안전하게 처리해야 함', () => {
      // Given: 예외를 발생시키는 execCommand
      const consoleError = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {})

      vi.spyOn(document, 'execCommand').mockImplementation(() => {
        throw new Error('execCommand failed')
      })

      // When: 제목 변경 시도
      const result = eventBus.emit('HEADING_CHANGED', { level: 1 })

      // Then: 에러 로그 발생 및 false 반환
      expect(result).toBe(false)
      expect(consoleError).toHaveBeenCalledWith(
        'Failed to execute heading command:',
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
      await pluginManager.register(HeadingPlugin)

      const execCommandSpy = vi
        .spyOn(document, 'execCommand')
        .mockReturnValue(true)

      let result = eventBus.emit('HEADING_CHANGED', { level: 1 })
      expect(result).toBe(true)
      expect(execCommandSpy).toHaveBeenCalledTimes(1)

      // When: 플러그인 destroy
      pluginManager.destroyAll()

      // Then: 이벤트가 더 이상 처리되지 않아야 함
      execCommandSpy.mockClear()
      result = eventBus.emit('HEADING_CHANGED', { level: 1 })

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
      const customPlugin = createHeadingPlugin({
        eventName: 'MY_HEADING_EVENT',
      })

      await pluginManager.register(customPlugin)

      const execCommandSpy = vi
        .spyOn(document, 'execCommand')
        .mockReturnValue(true)

      // When: 커스텀 이벤트 발행
      const result = eventBus.emit('MY_HEADING_EVENT', { level: 3 })

      // Then: 정상 실행되어야 함
      expect(result).toBe(true)
      expect(execCommandSpy).toHaveBeenCalledWith('formatBlock', false, '<h3>')

      execCommandSpy.mockRestore()
    })
  })

  describe('실제 시나리오 (사용자 동작 시뮬레이션)', () => {
    /**
     * Why: 실제 사용자 시나리오에서 제목 플러그인이 올바르게 동작하는지 검증
     * How: 드롭다운 선택, 빠른 변경, 키보드 단축키 등 다양한 사용자 동작 시뮬레이션
     */

    beforeEach(async () => {
      await pluginManager.register(HeadingPlugin)
    })

    it('제목 드롭다운 선택을 처리해야 함', () => {
      // Given: execCommand spy
      const execCommandSpy = vi
        .spyOn(document, 'execCommand')
        .mockReturnValue(true)

      // When: 사용자가 드롭다운에서 H2 선택
      eventBus.emit('HEADING_CHANGED', { level: 2 })

      // Then: formatBlock '<h2>' 명령이 실행되어야 함
      expect(execCommandSpy).toHaveBeenCalledWith('formatBlock', false, '<h2>')

      execCommandSpy.mockRestore()
    })

    it('빠른 제목 변경을 처리해야 함', () => {
      // Given: execCommand spy
      const execCommandSpy = vi
        .spyOn(document, 'execCommand')
        .mockReturnValue(true)

      // When: 사용자가 빠르게 제목 레벨 변경
      eventBus.emit('HEADING_CHANGED', { level: 1 })
      eventBus.emit('HEADING_CHANGED', { level: 2 })
      eventBus.emit('HEADING_CHANGED', { level: 3 })

      // Then: 모든 명령이 순차적으로 실행되어야 함
      expect(execCommandSpy).toHaveBeenCalledTimes(3)

      execCommandSpy.mockRestore()
    })

    it('다양한 제목 레벨의 키보드 단축키를 처리해야 함', () => {
      // Given: execCommand spy
      const execCommandSpy = vi
        .spyOn(document, 'execCommand')
        .mockReturnValue(true)

      // When: 키보드 단축키로 제목 레벨 변경
      eventBus.emit('HEADING_CHANGED', 1)
      eventBus.emit('HEADING_CHANGED', 2)
      eventBus.emit('HEADING_CHANGED', 3)

      // Then: 각 레벨에 맞는 명령이 실행되어야 함
      expect(execCommandSpy).toHaveBeenCalledTimes(3)
      expect(execCommandSpy).toHaveBeenNthCalledWith(
        1,
        'formatBlock',
        false,
        '<h1>'
      )
      expect(execCommandSpy).toHaveBeenNthCalledWith(
        2,
        'formatBlock',
        false,
        '<h2>'
      )
      expect(execCommandSpy).toHaveBeenNthCalledWith(
        3,
        'formatBlock',
        false,
        '<h3>'
      )

      execCommandSpy.mockRestore()
    })
  })
})
