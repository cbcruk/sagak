import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { EventBus } from '../../core/src/event-bus'
import { PluginManager } from '../../core/src/plugin-manager'
import { SelectionManager } from '../../core/src/selection-manager'
import { createAlignmentPlugin, AlignmentPlugin } from '../src/alignment-plugin'
import type { EditorContext } from '../../core/src/types'

describe('AlignmentPlugin', () => {
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
     * Why: `AlignmentPlugin`이 `PluginManager`에 정상적으로 등록되는지 확인
     * How: 기본 플러그인과 커스텀 옵션 플러그인을 등록한 후 `pluginManager.has()`로 검증
     */

    it('AlignmentPlugin', async () => {
      // Given: 빈 PluginManager
      // When: AlignmentPlugin 등록
      await pluginManager.register(AlignmentPlugin)

      // Then: 플러그인이 등록되어야 함
      expect(pluginManager.has('paragraph:alignment')).toBe(true)
      expect(pluginManager.size).toBe(1)
    })

    it('커스텀 옵션으로 플러그인을 생성해야 함', async () => {
      // Given: 커스텀 옵션을 가진 정렬 플러그인
      const customPlugin = createAlignmentPlugin({
        eventName: 'CUSTOM_ALIGN',
        checkComposition: false,
        allowedAlignments: ['left', 'center'],
      })

      // When: 커스텀 플러그인 등록
      await pluginManager.register(customPlugin)

      // Then: 플러그인이 등록되어야 함
      expect(pluginManager.has('paragraph:alignment')).toBe(true)
    })
  })

  describe('정렬 명령 실행 (텍스트 정렬 적용)', () => {
    /**
     * Why: 실제 브라우저 환경에서 정렬 명령이 올바르게 실행되는지 검증
     * How: 선택 영역을 생성한 후 `ALIGNMENT_CHANGED` 이벤트를 발행하여 `execCommand`로 `justifyLeft/Center/Right/Full` 호출 확인
     */

    beforeEach(async () => {
      await pluginManager.register(AlignmentPlugin)
    })

    it('왼쪽 정렬 명령을 실행해야 함', () => {
      // Given: execCommand spy와 선택 영역
      const execCommandSpy = vi.spyOn(document, 'execCommand')

      const textNode = element.firstChild!.firstChild as Text
      const range = document.createRange()
      range.setStart(textNode, 0)
      range.setEnd(textNode, 5)

      const selection = window.getSelection()!
      selection.removeAllRanges()
      selection.addRange(range)

      // When: 왼쪽 정렬 이벤트 발행
      const result = eventBus.emit('ALIGNMENT_CHANGED', { align: 'left' })

      // Then: justifyLeft 명령이 실행되어야 함
      expect(result).toBe(true)
      expect(execCommandSpy).toHaveBeenCalledWith('justifyLeft', false)

      execCommandSpy.mockRestore()
    })

    it('가운데 정렬 명령을 실행해야 함', () => {
      // Given: execCommand spy와 선택 영역
      const execCommandSpy = vi.spyOn(document, 'execCommand')

      const textNode = element.firstChild!.firstChild as Text
      const range = document.createRange()
      range.setStart(textNode, 0)
      range.setEnd(textNode, 5)

      const selection = window.getSelection()!
      selection.removeAllRanges()
      selection.addRange(range)

      // When: 가운데 정렬 이벤트 발행
      const result = eventBus.emit('ALIGNMENT_CHANGED', { align: 'center' })

      // Then: justifyCenter 명령이 실행되어야 함
      expect(result).toBe(true)
      expect(execCommandSpy).toHaveBeenCalledWith('justifyCenter', false)

      execCommandSpy.mockRestore()
    })

    it('오른쪽 정렬 명령을 실행해야 함', () => {
      // Given: execCommand spy와 선택 영역
      const execCommandSpy = vi.spyOn(document, 'execCommand')

      const textNode = element.firstChild!.firstChild as Text
      const range = document.createRange()
      range.setStart(textNode, 0)
      range.setEnd(textNode, 5)

      const selection = window.getSelection()!
      selection.removeAllRanges()
      selection.addRange(range)

      // When: 오른쪽 정렬 이벤트 발행
      const result = eventBus.emit('ALIGNMENT_CHANGED', { align: 'right' })

      // Then: justifyRight 명령이 실행되어야 함
      expect(result).toBe(true)
      expect(execCommandSpy).toHaveBeenCalledWith('justifyRight', false)

      execCommandSpy.mockRestore()
    })

    it('양쪽 정렬 명령을 실행해야 함', () => {
      // Given: execCommand spy와 선택 영역
      const execCommandSpy = vi.spyOn(document, 'execCommand')

      const textNode = element.firstChild!.firstChild as Text
      const range = document.createRange()
      range.setStart(textNode, 0)
      range.setEnd(textNode, 5)

      const selection = window.getSelection()!
      selection.removeAllRanges()
      selection.addRange(range)

      // When: 양쪽 정렬 이벤트 발행
      const result = eventBus.emit('ALIGNMENT_CHANGED', { align: 'justify' })

      // Then: justifyFull 명령이 실행되어야 함
      expect(result).toBe(true)
      expect(execCommandSpy).toHaveBeenCalledWith('justifyFull', false)

      execCommandSpy.mockRestore()
    })

    it('모든 정렬 타입을 지원해야 함', () => {
      // Given: execCommand spy
      const execCommandSpy = vi
        .spyOn(document, 'execCommand')
        .mockReturnValue(true)

      // When: 모든 정렬 타입 이벤트 발행
      eventBus.emit('ALIGNMENT_CHANGED', { align: 'left' })
      eventBus.emit('ALIGNMENT_CHANGED', { align: 'center' })
      eventBus.emit('ALIGNMENT_CHANGED', { align: 'right' })
      eventBus.emit('ALIGNMENT_CHANGED', { align: 'justify' })

      // Then: 각 정렬에 맞는 명령이 실행되어야 함
      expect(execCommandSpy).toHaveBeenCalledTimes(4)
      expect(execCommandSpy).toHaveBeenNthCalledWith(1, 'justifyLeft', false)
      expect(execCommandSpy).toHaveBeenNthCalledWith(2, 'justifyCenter', false)
      expect(execCommandSpy).toHaveBeenNthCalledWith(3, 'justifyRight', false)
      expect(execCommandSpy).toHaveBeenNthCalledWith(4, 'justifyFull', false)

      execCommandSpy.mockRestore()
    })

    it('객체 래퍼 없이 직접 문자열을 허용해야 함', () => {
      // Given: execCommand spy와 선택 영역
      const execCommandSpy = vi.spyOn(document, 'execCommand')

      const textNode = element.firstChild!.firstChild as Text
      const range = document.createRange()
      range.setStart(textNode, 0)
      range.setEnd(textNode, 5)

      const selection = window.getSelection()!
      selection.removeAllRanges()
      selection.addRange(range)

      // When: 문자열 형태로 정렬 이벤트 발행
      const result = eventBus.emit('ALIGNMENT_CHANGED', 'center')

      // Then: justifyCenter 명령이 실행되어야 함
      expect(result).toBe(true)
      expect(execCommandSpy).toHaveBeenCalledWith('justifyCenter', false)

      execCommandSpy.mockRestore()
    })

    it('정렬 변경 성공 후 STYLE_CHANGED 이벤트를 발행해야 함', () => {
      // Given: execCommand mock과 STYLE_CHANGED 리스너
      vi.spyOn(document, 'execCommand').mockReturnValue(true)

      const styleChangedSpy = vi.fn()
      eventBus.on('STYLE_CHANGED', 'on', styleChangedSpy)

      // When: 정렬 변경 이벤트 발행
      eventBus.emit('ALIGNMENT_CHANGED', { align: 'center' })

      // Then: STYLE_CHANGED 이벤트가 발행되어야 함
      expect(styleChangedSpy).toHaveBeenCalledWith({
        style: 'alignment',
        value: 'center',
      })

      vi.restoreAllMocks()
    })

    it('execCommand 실패 시 STYLE_CHANGED를 발행하지 않아야 함', () => {
      // Given: 실패하는 execCommand mock
      vi.spyOn(document, 'execCommand').mockReturnValue(false)

      const styleChangedSpy = vi.fn()
      eventBus.on('STYLE_CHANGED', 'on', styleChangedSpy)

      // When: 정렬 변경 이벤트 발행
      eventBus.emit('ALIGNMENT_CHANGED', { align: 'left' })

      // Then: STYLE_CHANGED 이벤트가 발행되지 않아야 함
      expect(styleChangedSpy).not.toHaveBeenCalled()

      vi.restoreAllMocks()
    })
  })

  describe('정렬 유효성 검사 (타입 검증)', () => {
    /**
     * Why: 잘못된 정렬 타입이 입력될 때 플러그인이 안전하게 차단하는지 검증
     * How: 유효하지 않은 정렬 값을 전달하여 경고 메시지 발생 및 `execCommand` 미실행 확인
     */

    beforeEach(async () => {
      await pluginManager.register(AlignmentPlugin)
    })

    it('유효하지 않은 정렬 타입을 거부해야 함', () => {
      // Given: console.warn spy와 execCommand spy
      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const execCommandSpy = vi.spyOn(document, 'execCommand')

      // When: 유효하지 않은 정렬 타입 전달
      eventBus.emit('ALIGNMENT_CHANGED', { align: 'invalid' })
      eventBus.emit('ALIGNMENT_CHANGED', { align: 'top' })
      eventBus.emit('ALIGNMENT_CHANGED', { align: 'bottom' })

      // Then: 명령이 실행되지 않고 경고만 발생
      expect(execCommandSpy).not.toHaveBeenCalled()
      expect(consoleWarn).toHaveBeenCalledTimes(3)

      consoleWarn.mockRestore()
      execCommandSpy.mockRestore()
    })

    it('정렬이 제공되지 않으면 차단해야 함', () => {
      // Given: console.warn spy와 execCommand spy
      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const execCommandSpy = vi.spyOn(document, 'execCommand')

      // When: 빈 객체 전달
      eventBus.emit('ALIGNMENT_CHANGED', {})

      // Then: 경고 메시지 발생 및 명령 미실행
      expect(execCommandSpy).not.toHaveBeenCalled()
      expect(consoleWarn).toHaveBeenCalledWith(
        'Alignment blocked: Invalid alignment "[object Object]" (must be left, center, right, or justify)'
      )

      consoleWarn.mockRestore()
      execCommandSpy.mockRestore()
    })

    it('데이터가 undefined일 때 차단해야 함', () => {
      // Given: console.warn spy와 execCommand spy
      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const execCommandSpy = vi.spyOn(document, 'execCommand')

      // When: undefined 전달
      eventBus.emit('ALIGNMENT_CHANGED')

      // Then: 경고 발생 및 명령 미실행
      expect(execCommandSpy).not.toHaveBeenCalled()
      expect(consoleWarn).toHaveBeenCalled()

      consoleWarn.mockRestore()
      execCommandSpy.mockRestore()
    })
  })

  describe('허용된 정렬 유효성 검사 (화이트리스트)', () => {
    /**
     * Why: 커스텀 옵션으로 특정 정렬만 허용하도록 제한할 수 있는지 검증
     * How: `allowedAlignments` 옵션으로 화이트리스트를 설정하고 허용/차단 여부 확인
     */

    it('허용 목록의 정렬을 허용해야 함', async () => {
      // Given: 특정 정렬만 허용하는 커스텀 플러그인
      pluginManager.destroyAll()

      const customPlugin = createAlignmentPlugin({
        allowedAlignments: ['left', 'center', 'right'],
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

      // When: 허용 목록에 있는 정렬 적용
      const result = eventBus.emit('ALIGNMENT_CHANGED', { align: 'center' })

      // Then: 명령이 성공적으로 실행되어야 함
      expect(result).toBe(true)
      expect(execCommandSpy).toHaveBeenCalled()

      execCommandSpy.mockRestore()
      newManager.destroyAll()
    })

    it('허용 목록에 없는 정렬을 차단해야 함', async () => {
      // Given: 특정 정렬만 허용하는 커스텀 플러그인
      pluginManager.destroyAll()

      const customPlugin = createAlignmentPlugin({
        allowedAlignments: ['left', 'center'],
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

      // When: 허용 목록에 없는 정렬 적용 시도
      const result = eventBus.emit('ALIGNMENT_CHANGED', { align: 'justify' })

      // Then: 경고 발생 및 명령 미실행
      expect(result).toBe(false)
      expect(consoleWarn).toHaveBeenCalledWith(
        'Alignment blocked: "justify" is not in allowed alignments'
      )
      expect(execCommandSpy).not.toHaveBeenCalled()

      consoleWarn.mockRestore()
      execCommandSpy.mockRestore()
      newManager.destroyAll()
    })
  })

  describe('CJK/IME 입력 지원 (조합 문자 처리)', () => {
    /**
     * Why: IME 입력 중 정렬 변경으로 인한 조합 문자 입력 방해 방지
     * How: `SelectionManager`의 조합 상태를 확인하여 IME 입력 중일 때 정렬 변경 차단
     */

    beforeEach(async () => {
      await pluginManager.register(AlignmentPlugin)
    })

    it('IME 입력 중에는 정렬 변경을 차단해야 함', () => {
      // Given: IME 조합 중인 상태
      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const execCommandSpy = vi.spyOn(document, 'execCommand')

      element.dispatchEvent(new CompositionEvent('compositionstart'))
      expect(selectionManager.getIsComposing()).toBe(true)

      // When: 정렬 변경 시도
      const result = eventBus.emit('ALIGNMENT_CHANGED', { align: 'center' })

      // Then: 차단되고 경고 발생
      expect(result).toBe(false)
      expect(consoleWarn).toHaveBeenCalledWith(
        'Alignment blocked: IME composition in progress'
      )
      expect(execCommandSpy).not.toHaveBeenCalled()

      consoleWarn.mockRestore()
      execCommandSpy.mockRestore()
    })

    it('조합 종료 후에는 정렬 변경을 허용해야 함', () => {
      // Given: IME 조합 종료 상태
      const execCommandSpy = vi
        .spyOn(document, 'execCommand')
        .mockReturnValue(true)

      element.dispatchEvent(new CompositionEvent('compositionstart'))
      element.dispatchEvent(new CompositionEvent('compositionend'))
      expect(selectionManager.getIsComposing()).toBe(false)

      // When: 정렬 변경 시도
      const result = eventBus.emit('ALIGNMENT_CHANGED', { align: 'center' })

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
      await pluginManager.register(AlignmentPlugin)
    })

    it('execCommand 에러를 안전하게 처리해야 함', () => {
      // Given: 예외를 발생시키는 execCommand
      const consoleError = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {})

      vi.spyOn(document, 'execCommand').mockImplementation(() => {
        throw new Error('execCommand failed')
      })

      // When: 정렬 변경 시도
      const result = eventBus.emit('ALIGNMENT_CHANGED', { align: 'center' })

      // Then: 에러 로그 발생 및 false 반환
      expect(result).toBe(false)
      expect(consoleError).toHaveBeenCalledWith(
        'Failed to execute alignment command:',
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
      await pluginManager.register(AlignmentPlugin)

      const execCommandSpy = vi
        .spyOn(document, 'execCommand')
        .mockReturnValue(true)

      let result = eventBus.emit('ALIGNMENT_CHANGED', { align: 'center' })
      expect(result).toBe(true)
      expect(execCommandSpy).toHaveBeenCalledTimes(1)

      // When: 플러그인 destroy
      pluginManager.destroyAll()

      // Then: 이벤트가 더 이상 처리되지 않아야 함
      execCommandSpy.mockClear()
      result = eventBus.emit('ALIGNMENT_CHANGED', { align: 'center' })

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
      const customPlugin = createAlignmentPlugin({
        eventName: 'MY_ALIGN_EVENT',
      })

      await pluginManager.register(customPlugin)

      const execCommandSpy = vi
        .spyOn(document, 'execCommand')
        .mockReturnValue(true)

      // When: 커스텀 이벤트 발행
      const result = eventBus.emit('MY_ALIGN_EVENT', { align: 'right' })

      // Then: 정상 실행되어야 함
      expect(result).toBe(true)
      expect(execCommandSpy).toHaveBeenCalledWith('justifyRight', false)

      execCommandSpy.mockRestore()
    })
  })

  describe('실제 시나리오 (사용자 동작 시뮬레이션)', () => {
    /**
     * Why: 실제 사용자 시나리오에서 정렬 플러그인이 올바르게 동작하는지 검증
     * How: 툴바 버튼 클릭, 빠른 변경, 키보드 단축키 등 다양한 사용자 동작 시뮬레이션
     */

    beforeEach(async () => {
      await pluginManager.register(AlignmentPlugin)
    })

    it('정렬 도구 모음 버튼을 처리해야 함', () => {
      // Given: execCommand spy
      const execCommandSpy = vi
        .spyOn(document, 'execCommand')
        .mockReturnValue(true)

      // When: 사용자가 툴바 버튼 클릭
      eventBus.emit('ALIGNMENT_CHANGED', { align: 'left' })
      eventBus.emit('ALIGNMENT_CHANGED', { align: 'center' })
      eventBus.emit('ALIGNMENT_CHANGED', { align: 'right' })

      // Then: 각 명령이 실행되어야 함
      expect(execCommandSpy).toHaveBeenCalledTimes(3)

      execCommandSpy.mockRestore()
    })

    it('빠른 정렬 변경을 처리해야 함', () => {
      // Given: execCommand spy
      const execCommandSpy = vi
        .spyOn(document, 'execCommand')
        .mockReturnValue(true)

      // When: 사용자가 빠르게 정렬 변경
      eventBus.emit('ALIGNMENT_CHANGED', 'left')
      eventBus.emit('ALIGNMENT_CHANGED', 'center')
      eventBus.emit('ALIGNMENT_CHANGED', 'right')
      eventBus.emit('ALIGNMENT_CHANGED', 'left')

      // Then: 모든 명령이 순차적으로 실행되어야 함
      expect(execCommandSpy).toHaveBeenCalledTimes(4)

      execCommandSpy.mockRestore()
    })

    it('정렬을 위한 키보드 단축키를 처리해야 함', () => {
      // Given: execCommand spy
      const execCommandSpy = vi
        .spyOn(document, 'execCommand')
        .mockReturnValue(true)

      // When: 키보드 단축키로 정렬 변경
      eventBus.emit('ALIGNMENT_CHANGED', 'left')
      eventBus.emit('ALIGNMENT_CHANGED', 'center')
      eventBus.emit('ALIGNMENT_CHANGED', 'right')

      // Then: 모든 명령이 실행되어야 함
      expect(execCommandSpy).toHaveBeenCalledTimes(3)

      execCommandSpy.mockRestore()
    })

    it('공식 문서용 양쪽 정렬을 처리해야 함', () => {
      // Given: execCommand spy
      const execCommandSpy = vi
        .spyOn(document, 'execCommand')
        .mockReturnValue(true)

      // When: 양쪽 정렬 적용
      eventBus.emit('ALIGNMENT_CHANGED', { align: 'justify' })

      // Then: justifyFull 명령이 실행되어야 함
      expect(execCommandSpy).toHaveBeenCalledWith('justifyFull', false)

      execCommandSpy.mockRestore()
    })
  })
})
