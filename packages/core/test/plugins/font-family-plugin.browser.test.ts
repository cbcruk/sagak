import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { EventBus } from '@/core/event-bus'
import { PluginManager } from '@/core/plugin-manager'
import { SelectionManager } from '@/core/selection-manager'
import {
  createFontFamilyPlugin,
  FontFamilyPlugin,
} from '@/plugins/font-family-plugin'
import type { EditorContext } from '@/core/types'

describe('FontFamilyPlugin (글꼴 설정)', () => {
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

    it('FontFamilyPlugin을 등록해야 함', async () => {
      // Given: 빈 PluginManager

      // When: FontFamilyPlugin 등록
      await pluginManager.register(FontFamilyPlugin)

      // Then: 플러그인이 등록됨
      expect(pluginManager.has('text-style:font-family')).toBe(true)
      expect(pluginManager.size).toBe(1)
    })

    it('커스텀 옵션으로 플러그인을 생성해야 함', async () => {
      // Given: 커스텀 옵션이 적용된 플러그인
      const customPlugin = createFontFamilyPlugin({
        eventName: 'CUSTOM_FONT_FAMILY',
        checkComposition: false,
        allowedFonts: ['Arial', 'Helvetica'],
      })

      // When: 커스텀 플러그인 등록
      await pluginManager.register(customPlugin)

      // Then: 동일한 이름으로 등록됨
      expect(pluginManager.has('text-style:font-family')).toBe(true)
    })
  })

  describe('글꼴 명령 실행 (fontName 설정)', () => {
    /**
     * Why: 사용자가 글꼴을 선택하면 선택된 텍스트에 글꼴 적용
     * How: `FONT_FAMILY_CHANGED` 이벤트 수신 → `execCommand('fontName')` 실행
     */

    beforeEach(async () => {
      await pluginManager.register(FontFamilyPlugin)
    })

    it('제공된 글꼴로 fontName 명령을 실행해야 함', () => {
      // Given: 텍스트가 선택된 상태
      const execCommandSpy = vi.spyOn(document, 'execCommand')
      const textNode = element.firstChild!.firstChild as Text
      const range = document.createRange()
      range.setStart(textNode, 0)
      range.setEnd(textNode, 5)

      const selection = window.getSelection()!
      selection.removeAllRanges()
      selection.addRange(range)

      // When: FONT_FAMILY_CHANGED 이벤트 발생
      const result = eventBus.emit('FONT_FAMILY_CHANGED', {
        fontFamily: 'Arial',
      })

      // Then: execCommand가 호출되고 성공 반환
      expect(result).toBe(true)
      expect(execCommandSpy).toHaveBeenCalledWith('fontName', false, 'Arial')

      execCommandSpy.mockRestore()
    })

    it('글꼴 변경 성공 후 STYLE_CHANGED 이벤트를 발생시켜야 함', () => {
      // Given: execCommand가 성공하는 상태
      vi.spyOn(document, 'execCommand').mockReturnValue(true)
      const styleChangedSpy = vi.fn()
      eventBus.on('STYLE_CHANGED', 'on', styleChangedSpy)

      // When: FONT_FAMILY_CHANGED 이벤트 발생
      eventBus.emit('FONT_FAMILY_CHANGED', { fontFamily: 'Times New Roman' })

      // Then: STYLE_CHANGED 이벤트가 발생함
      expect(styleChangedSpy).toHaveBeenCalledWith({
        style: 'fontFamily',
        value: 'Times New Roman',
      })

      vi.restoreAllMocks()
    })

    it('execCommand 실패 시 STYLE_CHANGED를 발생시키지 않아야 함', () => {
      // Given: execCommand가 실패하는 상태
      vi.spyOn(document, 'execCommand').mockReturnValue(false)
      const styleChangedSpy = vi.fn()
      eventBus.on('STYLE_CHANGED', 'on', styleChangedSpy)

      // When: FONT_FAMILY_CHANGED 이벤트 발생
      eventBus.emit('FONT_FAMILY_CHANGED', { fontFamily: 'Arial' })

      // Then: STYLE_CHANGED 이벤트가 발생하지 않음
      expect(styleChangedSpy).not.toHaveBeenCalled()

      vi.restoreAllMocks()
    })

    it('여러 글꼴을 처리해야 함', () => {
      // Given: execCommand가 성공하는 상태
      const execCommandSpy = vi
        .spyOn(document, 'execCommand')
        .mockReturnValue(true)
      const fonts = ['Arial', 'Helvetica', 'Times New Roman', 'Courier New']

      // When: 여러 글꼴로 이벤트 발생
      fonts.forEach((font) => {
        eventBus.emit('FONT_FAMILY_CHANGED', { fontFamily: font })
      })

      // Then: 모든 글꼴에 대해 execCommand 호출됨
      expect(execCommandSpy).toHaveBeenCalledTimes(4)
      fonts.forEach((font, index) => {
        expect(execCommandSpy).toHaveBeenNthCalledWith(
          index + 1,
          'fontName',
          false,
          font
        )
      })

      execCommandSpy.mockRestore()
    })
  })

  describe('검증 (입력값 확인)', () => {
    /**
     * Why: 잘못된 입력값으로 인한 오류를 방지해야 함
     * How: 이벤트 데이터의 fontFamily 값 유효성 검증
     */

    beforeEach(async () => {
      await pluginManager.register(FontFamilyPlugin)
    })

    it('fontFamily가 제공되지 않으면 차단해야 함', () => {
      // Given: fontFamily가 없는 이벤트 데이터
      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const execCommandSpy = vi.spyOn(document, 'execCommand')

      // When: fontFamily 없이 이벤트 발생
      const result = eventBus.emit('FONT_FAMILY_CHANGED', {})

      // Then: 차단됨
      expect(result).toBe(false)
      expect(consoleWarn).toHaveBeenCalledWith(
        'Font family blocked: No font family provided'
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
      const result = eventBus.emit('FONT_FAMILY_CHANGED')

      // Then: 차단됨
      expect(result).toBe(false)
      expect(consoleWarn).toHaveBeenCalled()
      expect(execCommandSpy).not.toHaveBeenCalled()

      consoleWarn.mockRestore()
      execCommandSpy.mockRestore()
    })
  })

  describe('허용된 글꼴 검증 (화이트리스트 확인)', () => {
    /**
     * Why: 허용된 글꼴만 적용되도록 제한해야 함
     * How: `allowedFonts` 옵션으로 화이트리스트 검증
     */

    it('허용 목록의 글꼴을 허용해야 함', async () => {
      // Given: 허용된 글꼴 목록이 설정된 플러그인
      pluginManager.destroyAll()

      const customPlugin = createFontFamilyPlugin({
        allowedFonts: ['Arial', 'Helvetica', 'Times New Roman'],
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

      // When: 허용된 글꼴로 이벤트 발생
      const result = eventBus.emit('FONT_FAMILY_CHANGED', {
        fontFamily: 'Arial',
      })

      // Then: 허용됨
      expect(result).toBe(true)
      expect(execCommandSpy).toHaveBeenCalled()

      execCommandSpy.mockRestore()
      newManager.destroyAll()
    })

    it('허용 목록에 없는 글꼴을 차단해야 함', async () => {
      // Given: 허용된 글꼴 목록이 설정된 플러그인
      pluginManager.destroyAll()

      const customPlugin = createFontFamilyPlugin({
        allowedFonts: ['Arial', 'Helvetica'],
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

      // When: 허용되지 않은 글꼴로 이벤트 발생
      const result = eventBus.emit('FONT_FAMILY_CHANGED', {
        fontFamily: 'Comic Sans MS',
      })

      // Then: 차단됨
      expect(result).toBe(false)
      expect(consoleWarn).toHaveBeenCalledWith(
        'Font family blocked: "Comic Sans MS" is not in allowed fonts'
      )
      expect(execCommandSpy).not.toHaveBeenCalled()

      consoleWarn.mockRestore()
      execCommandSpy.mockRestore()
      newManager.destroyAll()
    })
  })

  describe('CJK/IME 입력 지원 (조합 문자 처리)', () => {
    /**
     * Why: 한글 등 조합 문자 입력 중 글꼴 변경 시 입력이 깨질 수 있음
     * How: `SelectionManager.getIsComposing()`으로 조합 상태 확인 후 차단
     */

    beforeEach(async () => {
      await pluginManager.register(FontFamilyPlugin)
    })

    it('IME 입력 중에는 글꼴 변경을 차단해야 함', () => {
      // Given: IME 조합 중인 상태
      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const execCommandSpy = vi.spyOn(document, 'execCommand')

      element.dispatchEvent(new CompositionEvent('compositionstart'))
      expect(selectionManager.getIsComposing()).toBe(true)

      // When: 글꼴 변경 시도
      const result = eventBus.emit('FONT_FAMILY_CHANGED', {
        fontFamily: 'Arial',
      })

      // Then: BEFORE 단계에서 차단됨
      expect(result).toBe(false)
      expect(consoleWarn).toHaveBeenCalledWith(
        'Font family blocked: IME composition in progress'
      )
      expect(execCommandSpy).not.toHaveBeenCalled()

      consoleWarn.mockRestore()
      execCommandSpy.mockRestore()
    })

    it('조합 종료 후에는 글꼴 변경을 허용해야 함', () => {
      // Given: IME 조합이 종료된 상태
      const execCommandSpy = vi
        .spyOn(document, 'execCommand')
        .mockReturnValue(true)

      element.dispatchEvent(new CompositionEvent('compositionstart'))
      element.dispatchEvent(new CompositionEvent('compositionend'))
      expect(selectionManager.getIsComposing()).toBe(false)

      // When: 글꼴 변경 실행
      const result = eventBus.emit('FONT_FAMILY_CHANGED', {
        fontFamily: 'Arial',
      })

      // Then: 정상적으로 실행됨
      expect(result).toBe(true)
      expect(execCommandSpy).toHaveBeenCalled()

      execCommandSpy.mockRestore()
    })

    it('checkComposition이 false일 때 글꼴 변경을 허용해야 함', async () => {
      // Given: checkComposition이 비활성화된 플러그인
      pluginManager.destroyAll()

      const customPlugin = createFontFamilyPlugin({
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

      // When: IME 조합 중에도 글꼴 변경 실행
      const result = eventBus.emit('FONT_FAMILY_CHANGED', {
        fontFamily: 'Arial',
      })

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
      await pluginManager.register(FontFamilyPlugin)
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
      const result = eventBus.emit('FONT_FAMILY_CHANGED', {
        fontFamily: 'Arial',
      })

      // Then: 에러가 안전하게 처리됨
      expect(result).toBe(false)
      expect(consoleError).toHaveBeenCalledWith(
        'Failed to execute font family command:',
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
      await pluginManager.register(FontFamilyPlugin)

      const execCommandSpy = vi
        .spyOn(document, 'execCommand')
        .mockReturnValue(true)

      let result = eventBus.emit('FONT_FAMILY_CHANGED', { fontFamily: 'Arial' })
      expect(result).toBe(true)
      expect(execCommandSpy).toHaveBeenCalledTimes(1)

      // When: 플러그인 정리
      pluginManager.destroyAll()

      // Then: 더 이상 이벤트에 반응하지 않음
      execCommandSpy.mockClear()
      result = eventBus.emit('FONT_FAMILY_CHANGED', { fontFamily: 'Arial' })
      expect(execCommandSpy).not.toHaveBeenCalled()

      execCommandSpy.mockRestore()
    })
  })

  describe('커스텀 이벤트 이름 (이벤트 설정)', () => {
    /**
     * Why: 다른 이벤트 이름으로 플러그인을 사용할 수 있어야 함
     * How: `createFontFamilyPlugin({ eventName })` 옵션으로 커스텀 이벤트 설정
     */

    it('커스텀 이벤트 이름을 수신해야 함', async () => {
      // Given: 커스텀 이벤트 이름이 설정된 플러그인
      const customPlugin = createFontFamilyPlugin({
        eventName: 'MY_FONT_EVENT',
      })
      await pluginManager.register(customPlugin)

      const execCommandSpy = vi
        .spyOn(document, 'execCommand')
        .mockReturnValue(true)

      // When: 커스텀 이벤트 발생
      const result = eventBus.emit('MY_FONT_EVENT', { fontFamily: 'Arial' })

      // Then: 글꼴 명령이 실행됨
      expect(result).toBe(true)
      expect(execCommandSpy).toHaveBeenCalledWith('fontName', false, 'Arial')

      execCommandSpy.mockRestore()
    })
  })
})
