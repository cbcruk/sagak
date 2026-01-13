import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { EventBus } from '@/core/event-bus'
import { PluginManager } from '@/core/plugin-manager'
import { SelectionManager } from '@/core/selection-manager'
import {
  createTextColorPlugin,
  TextColorPlugin,
} from '@/plugins/text-color-plugin'
import type { EditorContext } from '@/core/types'

describe('TextColorPlugin (텍스트 색상 설정)', () => {
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
     * Why: `TextColorPlugin`을 `PluginManager`에 등록하여 사용 가능한 상태로 만들어야 합니다
     * How: `PluginManager.register()`를 호출하고 `has()`로 등록 여부를 확인합니다
     */

    it('TextColorPlugin을 등록해야 함', async () => {
      // Given: 빈 PluginManager

      // When: TextColorPlugin 등록
      await pluginManager.register(TextColorPlugin)

      // Then: 플러그인이 'text-style:text-color' 이름으로 등록됨
      expect(pluginManager.has('text-style:text-color')).toBe(true)
      expect(pluginManager.size).toBe(1)
    })

    it('커스텀 옵션으로 플러그인을 생성해야 함', async () => {
      // Given: 커스텀 옵션 설정
      const customPlugin = createTextColorPlugin({
        eventName: 'CUSTOM_COLOR',
        checkComposition: false,
        allowedColors: ['#FF0000', '#00FF00'],
      })

      // When: 커스텀 플러그인 등록
      await pluginManager.register(customPlugin)

      // Then: 플러그인이 정상적으로 등록됨
      expect(pluginManager.has('text-style:text-color')).toBe(true)
    })
  })

  describe('텍스트 색상 명령 실행 (foreColor 설정)', () => {
    /**
     * Why: 사용자가 선택한 텍스트에 색상을 적용해야 합니다
     * How: `EventBus`로 `TEXT_COLOR_CHANGED` 이벤트를 발생시키고, 내부적으로 `document.execCommand('foreColor')`를 실행합니다
     */

    beforeEach(async () => {
      // Given: TextColorPlugin 등록
      await pluginManager.register(TextColorPlugin)
    })

    it('hex 색상으로 foreColor 명령을 실행해야 함', () => {
      // Given: execCommand spy 설정과 텍스트 선택
      const execCommandSpy = vi.spyOn(document, 'execCommand')

      const textNode = element.firstChild!.firstChild as Text
      const range = document.createRange()
      range.setStart(textNode, 0)
      range.setEnd(textNode, 5)

      const selection = window.getSelection()!
      selection.removeAllRanges()
      selection.addRange(range)

      // When: hex 색상으로 TEXT_COLOR_CHANGED 이벤트 발생
      const result = eventBus.emit('TEXT_COLOR_CHANGED', { color: '#FF0000' })

      // Then: execCommand가 foreColor로 호출됨
      expect(result).toBe(true)
      expect(execCommandSpy).toHaveBeenCalledWith('foreColor', false, '#FF0000')

      execCommandSpy.mockRestore()
    })

    it('rgb 색상으로 foreColor 명령을 실행해야 함', () => {
      // Given: execCommand spy 설정과 텍스트 선택
      const execCommandSpy = vi.spyOn(document, 'execCommand')

      const textNode = element.firstChild!.firstChild as Text
      const range = document.createRange()
      range.setStart(textNode, 0)
      range.setEnd(textNode, 5)

      const selection = window.getSelection()!
      selection.removeAllRanges()
      selection.addRange(range)

      // When: rgb 색상으로 TEXT_COLOR_CHANGED 이벤트 발생
      const result = eventBus.emit('TEXT_COLOR_CHANGED', {
        color: 'rgb(255, 0, 0)',
      })

      // Then: execCommand가 rgb 색상으로 호출됨
      expect(result).toBe(true)
      expect(execCommandSpy).toHaveBeenCalledWith(
        'foreColor',
        false,
        'rgb(255, 0, 0)'
      )

      execCommandSpy.mockRestore()
    })

    it('색상 이름으로 foreColor 명령을 실행해야 함', () => {
      // Given: execCommand spy 설정과 텍스트 선택
      const execCommandSpy = vi.spyOn(document, 'execCommand')

      const textNode = element.firstChild!.firstChild as Text
      const range = document.createRange()
      range.setStart(textNode, 0)
      range.setEnd(textNode, 5)

      const selection = window.getSelection()!
      selection.removeAllRanges()
      selection.addRange(range)

      // When: 색상 이름으로 TEXT_COLOR_CHANGED 이벤트 발생
      const result = eventBus.emit('TEXT_COLOR_CHANGED', { color: 'red' })

      // Then: execCommand가 색상 이름으로 호출됨
      expect(result).toBe(true)
      expect(execCommandSpy).toHaveBeenCalledWith('foreColor', false, 'red')

      execCommandSpy.mockRestore()
    })

    it('색상 변경 성공 후 STYLE_CHANGED 이벤트를 발생시켜야 함', () => {
      // Given: execCommand가 성공하도록 모킹
      vi.spyOn(document, 'execCommand').mockReturnValue(true)

      const styleChangedSpy = vi.fn()
      eventBus.on('STYLE_CHANGED', 'on', styleChangedSpy)

      // When: TEXT_COLOR_CHANGED 이벤트 발생
      eventBus.emit('TEXT_COLOR_CHANGED', { color: '#0000FF' })

      // Then: STYLE_CHANGED 이벤트가 발생함
      expect(styleChangedSpy).toHaveBeenCalledWith({
        style: 'textColor',
        value: '#0000FF',
      })

      vi.restoreAllMocks()
    })

    it('execCommand 실패 시 STYLE_CHANGED를 발생시키지 않아야 함', () => {
      // Given: execCommand가 실패하도록 모킹
      vi.spyOn(document, 'execCommand').mockReturnValue(false)

      const styleChangedSpy = vi.fn()
      eventBus.on('STYLE_CHANGED', 'on', styleChangedSpy)

      // When: TEXT_COLOR_CHANGED 이벤트 발생
      eventBus.emit('TEXT_COLOR_CHANGED', { color: '#FF0000' })

      // Then: STYLE_CHANGED 이벤트가 발생하지 않음
      expect(styleChangedSpy).not.toHaveBeenCalled()

      vi.restoreAllMocks()
    })
  })

  describe('색상 형식 검증 (유효한 색상 확인)', () => {
    /**
     * Why: 잘못된 색상 형식으로 인한 브라우저 오류를 방지해야 합니다
     * How: 정규식으로 hex(#RRGGBB, #RGB), rgb/rgba, 색상 이름 형식을 검증합니다
     */

    beforeEach(async () => {
      // Given: TextColorPlugin 등록
      await pluginManager.register(TextColorPlugin)
    })

    it('유효한 hex 색상(#RRGGBB)을 허용해야 함', () => {
      // Given: execCommand를 성공으로 모킹
      const execCommandSpy = vi
        .spyOn(document, 'execCommand')
        .mockReturnValue(true)

      // When: 여러 hex 색상으로 이벤트 발생
      eventBus.emit('TEXT_COLOR_CHANGED', { color: '#FF0000' })
      eventBus.emit('TEXT_COLOR_CHANGED', { color: '#00FF00' })
      eventBus.emit('TEXT_COLOR_CHANGED', { color: '#0000FF' })

      // Then: execCommand가 3번 호출됨
      expect(execCommandSpy).toHaveBeenCalledTimes(3)

      execCommandSpy.mockRestore()
    })

    it('유효한 hex 색상(#RGB)을 허용해야 함', () => {
      // Given: execCommand를 성공으로 모킹
      const execCommandSpy = vi
        .spyOn(document, 'execCommand')
        .mockReturnValue(true)

      // When: 짧은 hex 색상으로 이벤트 발생
      eventBus.emit('TEXT_COLOR_CHANGED', { color: '#F00' })
      eventBus.emit('TEXT_COLOR_CHANGED', { color: '#0F0' })
      eventBus.emit('TEXT_COLOR_CHANGED', { color: '#00F' })

      // Then: execCommand가 3번 호출됨
      expect(execCommandSpy).toHaveBeenCalledTimes(3)

      execCommandSpy.mockRestore()
    })

    it('유효한 rgb 색상을 허용해야 함', () => {
      // Given: execCommand를 성공으로 모킹
      const execCommandSpy = vi
        .spyOn(document, 'execCommand')
        .mockReturnValue(true)

      // When: rgb 색상으로 이벤트 발생
      eventBus.emit('TEXT_COLOR_CHANGED', { color: 'rgb(255, 0, 0)' })
      eventBus.emit('TEXT_COLOR_CHANGED', { color: 'rgb(0,255,0)' })

      // Then: execCommand가 2번 호출됨
      expect(execCommandSpy).toHaveBeenCalledTimes(2)

      execCommandSpy.mockRestore()
    })

    it('유효한 rgba 색상을 허용해야 함', () => {
      // Given: execCommand를 성공으로 모킹
      const execCommandSpy = vi
        .spyOn(document, 'execCommand')
        .mockReturnValue(true)

      // When: rgba 색상으로 이벤트 발생
      eventBus.emit('TEXT_COLOR_CHANGED', { color: 'rgba(255, 0, 0, 0.5)' })

      // Then: execCommand가 호출됨
      expect(execCommandSpy).toHaveBeenCalled()

      execCommandSpy.mockRestore()
    })

    it('색상 이름을 허용해야 함', () => {
      // Given: execCommand를 성공으로 모킹
      const execCommandSpy = vi
        .spyOn(document, 'execCommand')
        .mockReturnValue(true)

      // When: 색상 이름으로 이벤트 발생
      eventBus.emit('TEXT_COLOR_CHANGED', { color: 'red' })
      eventBus.emit('TEXT_COLOR_CHANGED', { color: 'blue' })
      eventBus.emit('TEXT_COLOR_CHANGED', { color: 'green' })

      // Then: execCommand가 3번 호출됨
      expect(execCommandSpy).toHaveBeenCalledTimes(3)

      execCommandSpy.mockRestore()
    })

    it('유효하지 않은 색상 형식을 거부해야 함', () => {
      // Given: console.warn과 execCommand spy 설정
      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const execCommandSpy = vi.spyOn(document, 'execCommand')

      // When: 잘못된 색상 형식으로 이벤트 발생
      eventBus.emit('TEXT_COLOR_CHANGED', { color: '#GG0000' })
      eventBus.emit('TEXT_COLOR_CHANGED', { color: 'rgb(300, 0, 0)' }) // Still passes regex but invalid value

      // Then: 유효한 형식만 통과
      expect(execCommandSpy).toHaveBeenCalledTimes(1) // rgb(300,0,0) is valid format
      expect(consoleWarn).toHaveBeenCalledTimes(1) // #GG0000 is invalid format

      consoleWarn.mockRestore()
      execCommandSpy.mockRestore()
    })

    it('validateFormat이 false일 때 검증을 건너뛰어야 함', async () => {
      // Given: 검증을 비활성화한 커스텀 플러그인
      pluginManager.destroyAll()

      const customPlugin = createTextColorPlugin({
        validateFormat: false,
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

      // When: 잘못된 형식으로 이벤트 발생
      eventBus.emit('TEXT_COLOR_CHANGED', { color: 'any-value' })

      // Then: execCommand가 호출됨 (검증 없이)
      expect(execCommandSpy).toHaveBeenCalled()

      execCommandSpy.mockRestore()
      newManager.destroyAll()
    })
  })

  describe('허용된 색상 검증 (화이트리스트 확인)', () => {
    /**
     * Why: 특정 색상만 허용하여 일관된 디자인을 유지해야 합니다
     * How: `allowedColors` 옵션으로 허용 목록을 설정하고, 목록에 없는 색상은 차단합니다
     */

    it('허용 목록의 색상을 허용해야 함', async () => {
      // Given: 허용 색상 목록이 있는 커스텀 플러그인
      pluginManager.destroyAll()

      const customPlugin = createTextColorPlugin({
        allowedColors: ['#FF0000', '#00FF00', '#0000FF'],
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

      // When: 허용 목록의 색상으로 이벤트 발생
      const result = eventBus.emit('TEXT_COLOR_CHANGED', { color: '#FF0000' })

      // Then: 색상이 적용됨
      expect(result).toBe(true)
      expect(execCommandSpy).toHaveBeenCalled()

      execCommandSpy.mockRestore()
      newManager.destroyAll()
    })

    it('허용 목록에 없는 색상을 차단해야 함', async () => {
      // Given: 허용 색상 목록이 있는 커스텀 플러그인
      pluginManager.destroyAll()

      const customPlugin = createTextColorPlugin({
        allowedColors: ['#FF0000', '#00FF00'],
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

      // When: 허용 목록에 없는 색상으로 이벤트 발생
      const result = eventBus.emit('TEXT_COLOR_CHANGED', { color: '#0000FF' })

      // Then: 색상이 차단됨
      expect(result).toBe(false)
      expect(consoleWarn).toHaveBeenCalledWith(
        'Text color blocked: "#0000FF" is not in allowed colors'
      )
      expect(execCommandSpy).not.toHaveBeenCalled()

      consoleWarn.mockRestore()
      execCommandSpy.mockRestore()
      newManager.destroyAll()
    })
  })

  describe('검증 (입력값 확인)', () => {
    /**
     * Why: 잘못된 입력으로 인한 오류를 방지해야 합니다
     * How: 색상 값이 없거나 `undefined`인 경우 경고 메시지를 출력하고 명령을 차단합니다
     */

    beforeEach(async () => {
      // Given: TextColorPlugin 등록
      await pluginManager.register(TextColorPlugin)
    })

    it('색상이 제공되지 않으면 차단해야 함', () => {
      // Given: console.warn과 execCommand spy 설정
      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const execCommandSpy = vi.spyOn(document, 'execCommand')

      // When: 색상 없이 이벤트 발생
      const result = eventBus.emit('TEXT_COLOR_CHANGED', {})

      // Then: 명령이 차단됨
      expect(result).toBe(false)
      expect(consoleWarn).toHaveBeenCalledWith(
        'Text color blocked: No color provided'
      )
      expect(execCommandSpy).not.toHaveBeenCalled()

      consoleWarn.mockRestore()
      execCommandSpy.mockRestore()
    })

    it('data가 undefined면 차단해야 함', () => {
      // Given: console.warn과 execCommand spy 설정
      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const execCommandSpy = vi.spyOn(document, 'execCommand')

      // When: data 없이 이벤트 발생
      const result = eventBus.emit('TEXT_COLOR_CHANGED')

      // Then: 명령이 차단됨
      expect(result).toBe(false)
      expect(consoleWarn).toHaveBeenCalled()
      expect(execCommandSpy).not.toHaveBeenCalled()

      consoleWarn.mockRestore()
      execCommandSpy.mockRestore()
    })
  })

  describe('CJK/IME 입력 지원 (조합 문자 처리)', () => {
    /**
     * Why: 한글, 일본어, 중국어 입력 중 색상 변경이 발생하면 조합이 깨질 수 있습니다
     * How: `SelectionManager.getIsComposing()`으로 IME 상태를 확인하고, 조합 중에는 명령을 차단합니다
     */

    beforeEach(async () => {
      // Given: TextColorPlugin 등록
      await pluginManager.register(TextColorPlugin)
    })

    it('IME 입력 중에는 색상 변경을 차단해야 함', () => {
      // Given: IME 조합 시작
      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const execCommandSpy = vi.spyOn(document, 'execCommand')

      element.dispatchEvent(new CompositionEvent('compositionstart'))
      expect(selectionManager.getIsComposing()).toBe(true)

      // When: 조합 중에 색상 변경 시도
      const result = eventBus.emit('TEXT_COLOR_CHANGED', { color: '#FF0000' })

      // Then: 명령이 차단됨
      expect(result).toBe(false)
      expect(consoleWarn).toHaveBeenCalledWith(
        'Text color blocked: IME composition in progress'
      )
      expect(execCommandSpy).not.toHaveBeenCalled()

      consoleWarn.mockRestore()
      execCommandSpy.mockRestore()
    })

    it('조합 종료 후에는 색상 변경을 허용해야 함', () => {
      // Given: IME 조합 시작 후 종료
      const execCommandSpy = vi
        .spyOn(document, 'execCommand')
        .mockReturnValue(true)

      element.dispatchEvent(new CompositionEvent('compositionstart'))
      element.dispatchEvent(new CompositionEvent('compositionend'))
      expect(selectionManager.getIsComposing()).toBe(false)

      // When: 조합 종료 후 색상 변경 시도
      const result = eventBus.emit('TEXT_COLOR_CHANGED', { color: '#FF0000' })

      // Then: 명령이 실행됨
      expect(result).toBe(true)
      expect(execCommandSpy).toHaveBeenCalled()

      execCommandSpy.mockRestore()
    })
  })

  describe('에러 처리 (예외 상황 대응)', () => {
    /**
     * Why: `execCommand` 실행 중 예상치 못한 에러가 발생할 수 있습니다
     * How: try-catch로 에러를 포착하고 `console.error`로 로깅한 후 `false`를 반환합니다
     */

    beforeEach(async () => {
      // Given: TextColorPlugin 등록
      await pluginManager.register(TextColorPlugin)
    })

    it('execCommand 에러를 안전하게 처리해야 함', () => {
      // Given: execCommand가 에러를 발생시키도록 모킹
      const consoleError = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {})

      vi.spyOn(document, 'execCommand').mockImplementation(() => {
        throw new Error('execCommand failed')
      })

      // When: 색상 변경 시도
      const result = eventBus.emit('TEXT_COLOR_CHANGED', { color: '#FF0000' })

      // Then: 에러가 안전하게 처리됨
      expect(result).toBe(false)
      expect(consoleError).toHaveBeenCalledWith(
        'Failed to execute text color command:',
        expect.any(Error)
      )

      consoleError.mockRestore()
      vi.restoreAllMocks()
    })
  })

  describe('플러그인 생명주기 (초기화/정리)', () => {
    /**
     * Why: 플러그인 제거 시 이벤트 핸들러가 정리되어야 메모리 누수를 방지할 수 있습니다
     * How: `destroy()` 호출 후 이벤트가 더 이상 처리되지 않는지 확인합니다
     */

    it('destroy 시 정리를 수행해야 함', async () => {
      // Given: TextColorPlugin 등록
      await pluginManager.register(TextColorPlugin)

      const execCommandSpy = vi
        .spyOn(document, 'execCommand')
        .mockReturnValue(true)

      // When: 플러그인 활성화 상태에서 이벤트 발생
      let result = eventBus.emit('TEXT_COLOR_CHANGED', { color: '#FF0000' })
      expect(result).toBe(true)
      expect(execCommandSpy).toHaveBeenCalledTimes(1)

      // When: 플러그인 제거 후 이벤트 발생
      pluginManager.destroyAll()

      execCommandSpy.mockClear()
      result = eventBus.emit('TEXT_COLOR_CHANGED', { color: '#FF0000' })

      // Then: 이벤트가 처리되지 않음
      expect(execCommandSpy).not.toHaveBeenCalled()

      execCommandSpy.mockRestore()
    })
  })

  describe('커스텀 이벤트 이름 (이벤트 설정)', () => {
    /**
     * Why: 여러 색상 플러그인을 사용하거나 이벤트 이름을 커스터마이징해야 할 수 있습니다
     * How: `createTextColorPlugin({ eventName })` 옵션으로 커스텀 이벤트 이름을 설정합니다
     */

    it('커스텀 이벤트 이름을 수신해야 함', async () => {
      // Given: 커스텀 이벤트 이름을 가진 플러그인
      const customPlugin = createTextColorPlugin({
        eventName: 'MY_COLOR_EVENT',
      })

      await pluginManager.register(customPlugin)

      const execCommandSpy = vi
        .spyOn(document, 'execCommand')
        .mockReturnValue(true)

      // When: 커스텀 이벤트 발생
      const result = eventBus.emit('MY_COLOR_EVENT', { color: '#FF0000' })

      // Then: 이벤트가 처리됨
      expect(result).toBe(true)
      expect(execCommandSpy).toHaveBeenCalledWith('foreColor', false, '#FF0000')

      execCommandSpy.mockRestore()
    })
  })
})
