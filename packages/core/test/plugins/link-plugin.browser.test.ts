import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { EventBus } from '@/core/event-bus'
import { PluginManager } from '@/core/plugin-manager'
import { SelectionManager } from '@/core/selection-manager'
import { createLinkPlugin, LinkPlugin } from '@/plugins/link-plugin'
import type { EditorContext } from '@/core/types'

describe('LinkPlugin', () => {
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
     * Why: LinkPlugin이 올바르게 등록되고 초기화되는지 확인
     * How: `PluginManager`에 플러그인을 등록하고 존재 여부를 검증
     */

    it('LinkPlugin', async () => {
      // Given: PluginManager 준비됨

      // When: LinkPlugin을 등록
      await pluginManager.register(LinkPlugin)

      // Then: 플러그인이 등록되어야 함
      expect(pluginManager.has('content:link')).toBe(true)
      expect(pluginManager.size).toBe(1)
    })

    it('커스텀 옵션으로 플러그인을 생성해야 함', async () => {
      // Given: 커스텀 옵션 준비
      const customPlugin = createLinkPlugin({
        eventName: 'CUSTOM_LINK',
        unlinkEventName: 'CUSTOM_UNLINK',
        validateUrl: false,
        requireProtocol: true,
      })

      // When: 커스텀 플러그인 등록
      await pluginManager.register(customPlugin)

      // Then: 플러그인이 등록되어야 함
      expect(pluginManager.has('content:link')).toBe(true)
    })
  })

  describe('Link creation', () => {
    /**
     * Why: 사용자가 텍스트를 선택하고 링크를 추가할 수 있어야 함
     * How: `LINK_CHANGED` 이벤트 발행 시 `execCommand('createLink')`를 호출하고
     *      `STYLE_CHANGED` 이벤트를 발행
     */

    beforeEach(async () => {
      // Given: LinkPlugin 등록됨
      await pluginManager.register(LinkPlugin)
    })

    it('should execute createLink command with URL object', () => {
      // Given: execCommand spy와 텍스트 선택 준비
      const execCommandSpy = vi.spyOn(document, 'execCommand')
      const textNode = element.firstChild!.firstChild as Text
      const range = document.createRange()
      range.setStart(textNode, 0)
      range.setEnd(textNode, 5)
      const selection = window.getSelection()!
      selection.removeAllRanges()
      selection.addRange(range)

      // When: URL 객체로 LINK_CHANGED 이벤트 발행
      const result = eventBus.emit('LINK_CHANGED', {
        url: 'https://example.com',
      })

      // Then: createLink가 호출되어야 함
      expect(result).toBe(true)
      expect(execCommandSpy).toHaveBeenCalledWith(
        'createLink',
        false,
        'https://example.com'
      )

      execCommandSpy.mockRestore()
    })

    it('should execute createLink command with direct URL string', () => {
      // Given: execCommand spy와 텍스트 선택 준비
      const execCommandSpy = vi.spyOn(document, 'execCommand')
      const textNode = element.firstChild!.firstChild as Text
      const range = document.createRange()
      range.setStart(textNode, 0)
      range.setEnd(textNode, 5)
      const selection = window.getSelection()!
      selection.removeAllRanges()
      selection.addRange(range)

      // When: 직접 URL 문자열로 LINK_CHANGED 이벤트 발행
      const result = eventBus.emit('LINK_CHANGED', 'https://example.com')

      // Then: createLink가 호출되어야 함
      expect(result).toBe(true)
      expect(execCommandSpy).toHaveBeenCalledWith(
        'createLink',
        false,
        'https://example.com'
      )

      execCommandSpy.mockRestore()
    })

    it('should emit STYLE_CHANGED event after successful link creation', () => {
      // Given: execCommand mock과 이벤트 리스너 준비
      vi.spyOn(document, 'execCommand').mockReturnValue(true)
      const styleChangedSpy = vi.fn()
      eventBus.on('STYLE_CHANGED', 'on', styleChangedSpy)

      // When: LINK_CHANGED 이벤트 발행
      eventBus.emit('LINK_CHANGED', { url: 'https://example.com' })

      // Then: STYLE_CHANGED 이벤트가 발행되어야 함
      expect(styleChangedSpy).toHaveBeenCalledWith({
        style: 'link',
        value: 'https://example.com',
      })

      vi.restoreAllMocks()
    })

    it('should not emit STYLE_CHANGED if execCommand fails', () => {
      // Given: execCommand가 실패하도록 mock 설정
      vi.spyOn(document, 'execCommand').mockReturnValue(false)
      const styleChangedSpy = vi.fn()
      eventBus.on('STYLE_CHANGED', 'on', styleChangedSpy)

      // When: LINK_CHANGED 이벤트 발행
      eventBus.emit('LINK_CHANGED', { url: 'https://example.com' })

      // Then: STYLE_CHANGED 이벤트가 발행되지 않아야 함
      expect(styleChangedSpy).not.toHaveBeenCalled()

      vi.restoreAllMocks()
    })
  })

  describe('Link removal', () => {
    /**
     * Why: 사용자가 링크를 제거할 수 있어야 함
     * How: `LINK_REMOVED` 이벤트 발행 시 `execCommand('unlink')`를 호출
     */

    beforeEach(async () => {
      // Given: LinkPlugin 등록됨
      await pluginManager.register(LinkPlugin)
    })

    it('should execute unlink command', () => {
      // Given: execCommand spy와 텍스트 선택 준비
      const execCommandSpy = vi.spyOn(document, 'execCommand')
      const textNode = element.firstChild!.firstChild as Text
      const range = document.createRange()
      range.setStart(textNode, 0)
      range.setEnd(textNode, 5)
      const selection = window.getSelection()!
      selection.removeAllRanges()
      selection.addRange(range)

      // When: LINK_REMOVED 이벤트 발행
      const result = eventBus.emit('LINK_REMOVED')

      // Then: unlink가 호출되어야 함
      expect(result).toBe(true)
      expect(execCommandSpy).toHaveBeenCalledWith('unlink', false)

      execCommandSpy.mockRestore()
    })

    it('should emit STYLE_CHANGED event after successful unlink', () => {
      // Given: execCommand mock과 이벤트 리스너 준비
      vi.spyOn(document, 'execCommand').mockReturnValue(true)
      const styleChangedSpy = vi.fn()
      eventBus.on('STYLE_CHANGED', 'on', styleChangedSpy)

      // When: LINK_REMOVED 이벤트 발행
      eventBus.emit('LINK_REMOVED')

      // Then: STYLE_CHANGED 이벤트가 발행되어야 함
      expect(styleChangedSpy).toHaveBeenCalledWith({
        style: 'link',
        value: null,
      })

      vi.restoreAllMocks()
    })
  })

  describe('URL validation', () => {
    /**
     * Why: XSS 공격 등 보안 위협을 방지하기 위해 URL을 검증해야 함
     * How: `javascript:`, `data:` 등 위험한 프로토콜을 차단하고
     *      `http:`, `https:`, `mailto:`, `tel:` 등 안전한 URL만 허용
     */

    beforeEach(async () => {
      // Given: LinkPlugin 등록됨
      await pluginManager.register(LinkPlugin)
    })

    it('should accept valid HTTPS URLs', () => {
      // Given: execCommand mock 준비
      const execCommandSpy = vi
        .spyOn(document, 'execCommand')
        .mockReturnValue(true)

      // When: 유효한 HTTPS URL들로 이벤트 발행
      eventBus.emit('LINK_CHANGED', { url: 'https://example.com' })
      eventBus.emit('LINK_CHANGED', { url: 'https://www.example.com/path' })
      eventBus.emit('LINK_CHANGED', {
        url: 'https://example.com/path?query=value',
      })

      // Then: 모든 URL이 허용되어야 함
      expect(execCommandSpy).toHaveBeenCalledTimes(3)

      execCommandSpy.mockRestore()
    })

    it('should accept valid HTTP URLs', () => {
      // Given: execCommand mock 준비
      const execCommandSpy = vi
        .spyOn(document, 'execCommand')
        .mockReturnValue(true)

      // When: HTTP URL로 이벤트 발행
      eventBus.emit('LINK_CHANGED', { url: 'http://example.com' })

      // Then: HTTP URL이 허용되어야 함
      expect(execCommandSpy).toHaveBeenCalled()

      execCommandSpy.mockRestore()
    })

    it('should accept mailto links', () => {
      // Given: execCommand mock 준비
      const execCommandSpy = vi
        .spyOn(document, 'execCommand')
        .mockReturnValue(true)

      // When: mailto URL로 이벤트 발행
      eventBus.emit('LINK_CHANGED', { url: 'mailto:test@example.com' })

      // Then: mailto URL이 허용되어야 함
      expect(execCommandSpy).toHaveBeenCalled()

      execCommandSpy.mockRestore()
    })

    it('should accept tel links', () => {
      // Given: execCommand mock 준비
      const execCommandSpy = vi
        .spyOn(document, 'execCommand')
        .mockReturnValue(true)

      // When: tel URL로 이벤트 발행
      eventBus.emit('LINK_CHANGED', { url: 'tel:+1234567890' })

      // Then: tel URL이 허용되어야 함
      expect(execCommandSpy).toHaveBeenCalled()

      execCommandSpy.mockRestore()
    })

    it('should accept relative URLs', () => {
      // Given: execCommand mock 준비
      const execCommandSpy = vi
        .spyOn(document, 'execCommand')
        .mockReturnValue(true)

      // When: 상대 경로 URL들로 이벤트 발행
      eventBus.emit('LINK_CHANGED', { url: '/path/to/page' })
      eventBus.emit('LINK_CHANGED', { url: './relative/path' })
      eventBus.emit('LINK_CHANGED', { url: '../parent/path' })

      // Then: 모든 상대 경로가 허용되어야 함
      expect(execCommandSpy).toHaveBeenCalledTimes(3)

      execCommandSpy.mockRestore()
    })

    it('should reject invalid URLs when validation is enabled', () => {
      // Given: console.warn spy와 execCommand spy 준비
      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const execCommandSpy = vi.spyOn(document, 'execCommand')

      // When: 위험한 URL로 이벤트 발행
      eventBus.emit('LINK_CHANGED', { url: 'javascript:alert(1)' })
      eventBus.emit('LINK_CHANGED', {
        url: 'data:text/html,<script>alert(1)</script>',
      })

      // Then: execCommand가 호출되지 않고 경고가 출력되어야 함
      expect(execCommandSpy).not.toHaveBeenCalled()
      expect(consoleWarn).toHaveBeenCalledTimes(2)

      consoleWarn.mockRestore()
      execCommandSpy.mockRestore()
    })

    it('should block when no URL is provided', () => {
      // Given: console.warn spy와 execCommand spy 준비
      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const execCommandSpy = vi.spyOn(document, 'execCommand')

      // When: URL 없이 이벤트 발행
      eventBus.emit('LINK_CHANGED', {})

      // Then: 차단되고 경고가 출력되어야 함
      expect(execCommandSpy).not.toHaveBeenCalled()
      expect(consoleWarn).toHaveBeenCalledWith('Link blocked: No URL provided')

      consoleWarn.mockRestore()
      execCommandSpy.mockRestore()
    })

    it('should block when data is undefined', () => {
      // Given: console.warn spy와 execCommand spy 준비
      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const execCommandSpy = vi.spyOn(document, 'execCommand')

      // When: 데이터 없이 이벤트 발행
      eventBus.emit('LINK_CHANGED')

      // Then: 차단되고 경고가 출력되어야 함
      expect(execCommandSpy).not.toHaveBeenCalled()
      expect(consoleWarn).toHaveBeenCalled()

      consoleWarn.mockRestore()
      execCommandSpy.mockRestore()
    })
  })

  describe('Protocol validation', () => {
    /**
     * Why: 보안 정책에 따라 특정 프로토콜만 허용해야 하는 경우가 있음
     * How: `requireProtocol`, `allowedProtocols` 옵션으로 프로토콜 검증 규칙을 설정
     */

    it('should require protocol when requireProtocol is true', async () => {
      // Given: requireProtocol이 true인 커스텀 플러그인 준비
      pluginManager.destroyAll()
      const customPlugin = createLinkPlugin({
        requireProtocol: true,
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

      // When: 프로토콜이 있는 URL과 없는 URL로 이벤트 발행
      eventBus.emit('LINK_CHANGED', { url: 'https://example.com' })
      expect(execCommandSpy).toHaveBeenCalledTimes(1)

      eventBus.emit('LINK_CHANGED', { url: '/relative/path' })

      // Then: 프로토콜 없는 URL은 차단되어야 함
      expect(execCommandSpy).toHaveBeenCalledTimes(1)

      consoleWarn.mockRestore()
      execCommandSpy.mockRestore()
      newManager.destroyAll()
    })

    it('should validate against allowed protocols', async () => {
      // Given: allowedProtocols이 설정된 커스텀 플러그인 준비
      pluginManager.destroyAll()
      const customPlugin = createLinkPlugin({
        allowedProtocols: ['https:'],
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

      // When: 허용된 프로토콜과 허용되지 않은 프로토콜로 이벤트 발행
      eventBus.emit('LINK_CHANGED', { url: 'https://example.com' })
      expect(execCommandSpy).toHaveBeenCalledTimes(1)

      eventBus.emit('LINK_CHANGED', { url: 'http://example.com' })

      // Then: 허용되지 않은 프로토콜은 차단되어야 함
      expect(execCommandSpy).toHaveBeenCalledTimes(1)
      expect(consoleWarn).toHaveBeenCalledTimes(1)

      consoleWarn.mockRestore()
      execCommandSpy.mockRestore()
      newManager.destroyAll()
    })

    it('should skip validation when validateUrl is false', async () => {
      // Given: validateUrl이 false인 커스텀 플러그인 준비
      pluginManager.destroyAll()
      const customPlugin = createLinkPlugin({
        validateUrl: false,
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

      // When: 유효하지 않은 URL로 이벤트 발행
      eventBus.emit('LINK_CHANGED', { url: 'any-value' })

      // Then: 검증 없이 통과해야 함
      expect(execCommandSpy).toHaveBeenCalled()

      execCommandSpy.mockRestore()
      newManager.destroyAll()
    })
  })

  describe('CJK/IME 입력 지원 (조합 문자 처리)', () => {
    /**
     * Why: 한글, 일본어 등 조합 문자 입력 중 링크 생성/삭제를 방지해야 함
     * How: `SelectionManager.getIsComposing()`으로 조합 상태를 확인하고 차단
     */

    beforeEach(async () => {
      // Given: LinkPlugin 등록됨
      await pluginManager.register(LinkPlugin)
    })

    it('should block link creation during IME composition', () => {
      // Given: console.warn spy와 execCommand spy 준비, IME 조합 시작
      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const execCommandSpy = vi.spyOn(document, 'execCommand')

      element.dispatchEvent(new CompositionEvent('compositionstart'))
      expect(selectionManager.getIsComposing()).toBe(true)

      // When: 조합 중 LINK_CHANGED 이벤트 발행
      const result = eventBus.emit('LINK_CHANGED', {
        url: 'https://example.com',
      })

      // Then: 차단되고 경고가 출력되어야 함
      expect(result).toBe(false)
      expect(consoleWarn).toHaveBeenCalledWith(
        'Link blocked: IME composition in progress'
      )
      expect(execCommandSpy).not.toHaveBeenCalled()

      consoleWarn.mockRestore()
      execCommandSpy.mockRestore()
    })

    it('should block unlink during IME composition', () => {
      // Given: console.warn spy와 execCommand spy 준비, IME 조합 시작
      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const execCommandSpy = vi.spyOn(document, 'execCommand')

      element.dispatchEvent(new CompositionEvent('compositionstart'))
      expect(selectionManager.getIsComposing()).toBe(true)

      // When: 조합 중 LINK_REMOVED 이벤트 발행
      const result = eventBus.emit('LINK_REMOVED')

      // Then: 차단되고 경고가 출력되어야 함
      expect(result).toBe(false)
      expect(consoleWarn).toHaveBeenCalledWith(
        'Unlink blocked: IME composition in progress'
      )
      expect(execCommandSpy).not.toHaveBeenCalled()

      consoleWarn.mockRestore()
      execCommandSpy.mockRestore()
    })

    it('should allow link operations after composition ends', () => {
      // Given: execCommand mock 준비, IME 조합 시작 후 종료
      const execCommandSpy = vi
        .spyOn(document, 'execCommand')
        .mockReturnValue(true)

      element.dispatchEvent(new CompositionEvent('compositionstart'))
      element.dispatchEvent(new CompositionEvent('compositionend'))
      expect(selectionManager.getIsComposing()).toBe(false)

      // When: 조합 종료 후 LINK_CHANGED 이벤트 발행
      const result = eventBus.emit('LINK_CHANGED', {
        url: 'https://example.com',
      })

      // Then: 정상 동작해야 함
      expect(result).toBe(true)
      expect(execCommandSpy).toHaveBeenCalled()

      execCommandSpy.mockRestore()
    })
  })

  describe('에러 처리 (예외 상황 대응)', () => {
    /**
     * Why: `execCommand` 실행 중 예외가 발생해도 에디터가 중단되지 않아야 함
     * How: try-catch로 예외를 잡고 콘솔에 에러를 출력
     */

    beforeEach(async () => {
      // Given: LinkPlugin 등록됨
      await pluginManager.register(LinkPlugin)
    })

    it('should handle createLink errors gracefully', () => {
      // Given: execCommand가 예외를 발생시키도록 mock 설정
      const consoleError = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {})

      vi.spyOn(document, 'execCommand').mockImplementation(() => {
        throw new Error('execCommand failed')
      })

      // When: LINK_CHANGED 이벤트 발행
      const result = eventBus.emit('LINK_CHANGED', {
        url: 'https://example.com',
      })

      // Then: false를 반환하고 에러가 출력되어야 함
      expect(result).toBe(false)
      expect(consoleError).toHaveBeenCalledWith(
        'Failed to execute link command:',
        expect.any(Error)
      )

      consoleError.mockRestore()
      vi.restoreAllMocks()
    })

    it('should handle unlink errors gracefully', () => {
      // Given: execCommand가 예외를 발생시키도록 mock 설정
      const consoleError = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {})

      vi.spyOn(document, 'execCommand').mockImplementation(() => {
        throw new Error('execCommand failed')
      })

      // When: LINK_REMOVED 이벤트 발행
      const result = eventBus.emit('LINK_REMOVED')

      // Then: false를 반환하고 에러가 출력되어야 함
      expect(result).toBe(false)
      expect(consoleError).toHaveBeenCalledWith(
        'Failed to execute unlink command:',
        expect.any(Error)
      )

      consoleError.mockRestore()
      vi.restoreAllMocks()
    })
  })

  describe('플러그인 생명주기 (초기화/정리)', () => {
    /**
     * Why: 플러그인 정리 시 이벤트 핸들러가 해제되어야 함
     * How: `destroy()` 호출 후 이벤트가 처리되지 않는지 확인
     */

    it('destroy 시 정리를 수행해야 함', async () => {
      // Given: LinkPlugin 등록되고 동작 확인
      await pluginManager.register(LinkPlugin)

      const execCommandSpy = vi
        .spyOn(document, 'execCommand')
        .mockReturnValue(true)

      let result = eventBus.emit('LINK_CHANGED', { url: 'https://example.com' })
      expect(result).toBe(true)
      expect(execCommandSpy).toHaveBeenCalledTimes(1)

      // When: 플러그인 정리
      pluginManager.destroyAll()

      // Then: 이벤트가 처리되지 않아야 함
      execCommandSpy.mockClear()
      result = eventBus.emit('LINK_CHANGED', { url: 'https://example.com' })

      expect(execCommandSpy).not.toHaveBeenCalled()

      execCommandSpy.mockRestore()
    })
  })

  describe('Custom event names', () => {
    /**
     * Why: 여러 링크 플러그인을 사용하거나 이벤트 이름 충돌을 피하기 위해
     * How: `eventName`, `unlinkEventName` 옵션으로 커스텀 이벤트 이름 설정
     */

    it('should listen to custom event names', async () => {
      // Given: 커스텀 이벤트 이름을 사용하는 플러그인 준비
      const customPlugin = createLinkPlugin({
        eventName: 'MY_LINK_EVENT',
        unlinkEventName: 'MY_UNLINK_EVENT',
      })

      await pluginManager.register(customPlugin)

      const execCommandSpy = vi
        .spyOn(document, 'execCommand')
        .mockReturnValue(true)

      // When: 커스텀 이벤트 발행
      eventBus.emit('MY_LINK_EVENT', { url: 'https://example.com' })
      eventBus.emit('MY_UNLINK_EVENT')

      // Then: 커스텀 이벤트가 처리되어야 함
      expect(execCommandSpy).toHaveBeenCalledWith(
        'createLink',
        false,
        'https://example.com'
      )
      expect(execCommandSpy).toHaveBeenCalledWith('unlink', false)

      execCommandSpy.mockRestore()
    })
  })

  describe('실제 시나리오 (사용자 동작 시뮬레이션)', () => {
    /**
     * Why: 실제 사용자의 링크 생성/편집/삭제 워크플로우를 검증
     * How: 외부 링크, 이메일, 전화번호, 상대 경로 등 다양한 링크 타입을 테스트
     */

    beforeEach(async () => {
      // Given: LinkPlugin 등록됨
      await pluginManager.register(LinkPlugin)
    })

    it('should create external link', () => {
      // Given: execCommand mock 준비
      const execCommandSpy = vi
        .spyOn(document, 'execCommand')
        .mockReturnValue(true)

      // When: 외부 링크 생성
      eventBus.emit('LINK_CHANGED', { url: 'https://example.com' })

      // Then: createLink가 호출되어야 함
      expect(execCommandSpy).toHaveBeenCalledWith(
        'createLink',
        false,
        'https://example.com'
      )

      execCommandSpy.mockRestore()
    })

    it('should create email link', () => {
      // Given: execCommand mock 준비
      const execCommandSpy = vi
        .spyOn(document, 'execCommand')
        .mockReturnValue(true)

      // When: 이메일 링크 생성
      eventBus.emit('LINK_CHANGED', { url: 'mailto:test@example.com' })

      // Then: createLink가 호출되어야 함
      expect(execCommandSpy).toHaveBeenCalledWith(
        'createLink',
        false,
        'mailto:test@example.com'
      )

      execCommandSpy.mockRestore()
    })

    it('should create phone link', () => {
      // Given: execCommand mock 준비
      const execCommandSpy = vi
        .spyOn(document, 'execCommand')
        .mockReturnValue(true)

      // When: 전화번호 링크 생성
      eventBus.emit('LINK_CHANGED', { url: 'tel:+1234567890' })

      // Then: createLink가 호출되어야 함
      expect(execCommandSpy).toHaveBeenCalledWith(
        'createLink',
        false,
        'tel:+1234567890'
      )

      execCommandSpy.mockRestore()
    })

    it('should create internal/relative link', () => {
      // Given: execCommand mock 준비
      const execCommandSpy = vi
        .spyOn(document, 'execCommand')
        .mockReturnValue(true)

      // When: 상대 경로 링크 생성
      eventBus.emit('LINK_CHANGED', { url: '/docs/guide' })

      // Then: createLink가 호출되어야 함
      expect(execCommandSpy).toHaveBeenCalledWith(
        'createLink',
        false,
        '/docs/guide'
      )

      execCommandSpy.mockRestore()
    })

    it('should handle link edit by creating new link', () => {
      // Given: execCommand mock 준비
      const execCommandSpy = vi
        .spyOn(document, 'execCommand')
        .mockReturnValue(true)

      // When: 링크 생성 후 수정
      eventBus.emit('LINK_CHANGED', { url: 'https://old.com' })
      eventBus.emit('LINK_CHANGED', { url: 'https://new.com' })

      // Then: createLink가 두 번 호출되어야 함
      expect(execCommandSpy).toHaveBeenCalledTimes(2)

      execCommandSpy.mockRestore()
    })

    it('should handle link removal', () => {
      // Given: execCommand mock 준비
      const execCommandSpy = vi
        .spyOn(document, 'execCommand')
        .mockReturnValue(true)

      // When: 링크 생성 후 삭제
      eventBus.emit('LINK_CHANGED', { url: 'https://example.com' })
      eventBus.emit('LINK_REMOVED')

      // Then: createLink와 unlink가 순서대로 호출되어야 함
      expect(execCommandSpy).toHaveBeenCalledTimes(2)
      expect(execCommandSpy).toHaveBeenNthCalledWith(
        1,
        'createLink',
        false,
        'https://example.com'
      )
      expect(execCommandSpy).toHaveBeenNthCalledWith(2, 'unlink', false)

      execCommandSpy.mockRestore()
    })
  })
})
