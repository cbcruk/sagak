import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { EventBus } from '@/core/event-bus'
import { trackComposition } from '@/core/composition'
import type { CompositionTracker } from '@/core/composition'
import { PluginManager } from '@/core/plugin-manager'
import {
  createFindReplacePlugin,
  FindReplacePlugin,
} from '@/plugins/find-replace-plugin'
import { WysiwygArea } from '@/editor/editing-area/modes/wysiwyg-area'
import type { EditorContext, EditingAreaManager } from '@/core/types'
import type { FindData, ReplaceData } from '@/plugins/find-replace-plugin'

/**
 * 찾기는 이제 **문서 모델 위에서** 돕니다.
 *
 * 예전에는 맨 `contentEditable` div 하나를 놓고 그 안의 텍스트 노드를 훑었고,
 * 강조도 그 자리에 `<span>` 을 끼워 넣어 만들었습니다. 그래서 검사도 div
 * 하나면 됐습니다.
 *
 * 이제 검사가 편집 영역을 통째로 세웁니다. 강조는 **데코레이션**이라 화면에는
 * `.find-highlight` 로 보이지만 문서에는 없고, 바꾸기는 트랜잭션이라
 * `getRawContent()` 가 곧 결과입니다.
 */
describe('FindReplacePlugin', () => {
  let eventBus: EventBus
  let pluginManager: PluginManager
  let composition: CompositionTracker
  let container: HTMLDivElement
  let area: WysiwygArea
  let element: HTMLElement
  let context: EditorContext

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)

    eventBus = new EventBus()
    area = new WysiwygArea({ container, eventBus })
    area.setRawContent('<p>Hello World. Hello everyone. This is a test.</p>')
    element = area.getElement()
    composition = trackComposition(element)

    context = {
      eventBus,
      composition,
      config: { element },
      editingAreaManager: {
        getCurrentArea: () => area,
      } as unknown as EditingAreaManager,
    }
    pluginManager = new PluginManager(context)
  })

  afterEach(() => {
    area.destroy()
    document.body.removeChild(container)
  })

  describe('플러그인 등록 (기본 초기화)', () => {
    /**
     * Why: FindReplacePlugin이 올바르게 등록되고 초기화되는지 확인
     * How: `PluginManager`에 플러그인을 등록하고 존재 여부를 검증
     */

    it('FindReplacePlugin', async () => {
      // Given: PluginManager 준비됨

      // When: FindReplacePlugin을 등록
      await pluginManager.register(FindReplacePlugin)

      // Then: 플러그인이 등록되어야 함
      expect(pluginManager.has('utility:find-replace')).toBe(true)
      expect(pluginManager.size).toBe(1)
    })

    it('커스텀 옵션으로 플러그인을 생성해야 함', async () => {
      // Given: 커스텀 옵션 준비
      const customPlugin = createFindReplacePlugin({
        highlightColor: '#00ff00',
        currentHighlightColor: '#ff0000',
      })

      // When: 커스텀 플러그인 등록
      await pluginManager.register(customPlugin)

      // Then: 플러그인이 등록되어야 함
      expect(pluginManager.has('utility:find-replace')).toBe(true)
    })
  })

  describe('Find functionality', () => {
    /**
     * Why: 사용자가 에디터 내에서 텍스트를 검색할 수 있어야 함
     * How: `FIND` 이벤트 발행 시 검색어와 일치하는 텍스트를 찾아 하이라이트 표시하고
     *      `STYLE_CHANGED` 이벤트로 검색 결과 개수를 알림
     */

    beforeEach(async () => {
      // Given: FindReplacePlugin 등록됨
      await pluginManager.register(FindReplacePlugin)
    })

    it('should find text and highlight matches', () => {
      // Given: 이벤트 리스너 준비
      const styleChangedSpy = vi.fn()
      eventBus.on('STYLE_CHANGED', styleChangedSpy)

      const findData: FindData = {
        query: 'Hello',
      }

      // When: FIND 이벤트 발행
      const result = eventBus.emit('FIND', findData)

      // Then: 검색어가 하이라이트되고 결과 개수가 반환되어야 함
      expect(result).toBe(true)
      expect(styleChangedSpy).toHaveBeenCalledWith({
        style: 'find',
        action: 'find',
        matchCount: 2,
        matchIndex: 0,
      })

      const highlights = element.querySelectorAll('.find-highlight')
      expect(highlights.length).toBe(2)

      vi.restoreAllMocks()
    })

    it('should find text case-insensitively by default', () => {
      // Given: 이벤트 리스너 준비
      const styleChangedSpy = vi.fn()
      eventBus.on('STYLE_CHANGED', styleChangedSpy)

      // When: 소문자로 검색
      eventBus.emit('FIND', { query: 'hello' })

      // Then: 대소문자 구분 없이 검색되어야 함
      expect(styleChangedSpy).toHaveBeenCalledWith({
        style: 'find',
        action: 'find',
        matchCount: 2,
        matchIndex: 0,
      })

      vi.restoreAllMocks()
    })

    it('should find text case-sensitively when specified', () => {
      // Given: 이벤트 리스너 준비
      const styleChangedSpy = vi.fn()
      eventBus.on('STYLE_CHANGED', styleChangedSpy)

      // When: 대소문자 구분 검색
      eventBus.emit('FIND', {
        query: 'hello',
        caseSensitive: true,
      })

      // Then: 대소문자가 일치하지 않아 검색 결과가 없어야 함
      expect(styleChangedSpy).toHaveBeenCalledWith({
        style: 'find',
        action: 'find',
        matchCount: 0,
        matchIndex: -1,
      })

      vi.restoreAllMocks()
    })

    it('should find whole words only when specified', () => {
      // Given: 부분 일치 텍스트로 HTML 변경
      area.setRawContent('<p>Hello Helloworld world</p>')

      const styleChangedSpy = vi.fn()
      eventBus.on('STYLE_CHANGED', styleChangedSpy)

      // When: 단어 단위 검색
      eventBus.emit('FIND', {
        query: 'Hello',
        wholeWord: true,
      })

      // Then: 단어 단위로만 일치하는 결과만 검색되어야 함
      expect(styleChangedSpy).toHaveBeenCalledWith({
        style: 'find',
        action: 'find',
        matchCount: 1,
        matchIndex: 0,
      })

      vi.restoreAllMocks()
    })

    it('should reject find without query', () => {
      // Given: console.warn spy 준비
      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})

      // When: 빈 검색어로 FIND 이벤트 발행
      const result = eventBus.emit('FIND', { query: '' } as any)

      // Then: 차단되고 경고가 출력되어야 함
      expect(result).toBe(false)
      expect(consoleWarn).toHaveBeenCalledWith(
        'Find blocked: Invalid find data'
      )

      consoleWarn.mockRestore()
    })

    it('should handle no matches found', () => {
      // Given: 이벤트 리스너 준비
      const styleChangedSpy = vi.fn()
      eventBus.on('STYLE_CHANGED', styleChangedSpy)

      // When: 존재하지 않는 텍스트 검색
      eventBus.emit('FIND', { query: 'nonexistent' })

      // Then: 검색 결과가 0이어야 함
      expect(styleChangedSpy).toHaveBeenCalledWith({
        style: 'find',
        action: 'find',
        matchCount: 0,
        matchIndex: -1,
      })

      const highlights = element.querySelectorAll('.find-highlight')
      expect(highlights.length).toBe(0)

      vi.restoreAllMocks()
    })
  })

  describe('Find navigation', () => {
    /**
     * Why: 사용자가 검색 결과 간 이동할 수 있어야 함
     * How: `FIND_NEXT`, `FIND_PREVIOUS` 이벤트로 검색 결과를 순회하고,
     *      마지막/첫 번째 결과에서 순환 이동
     */

    beforeEach(async () => {
      // Given: FindReplacePlugin 등록되고 검색 실행됨
      await pluginManager.register(FindReplacePlugin)
      area.setRawContent('<p>test test test</p>')

      eventBus.emit('FIND', { query: 'test' })
    })

    /**
     * 이전 판은 `highlights[0]` 의 색을 이동 **전에** 찍어 두고 이동 **후** 의
     * `highlights[1]` 과 달라야 한다고 단언했습니다. 둘 다 "현재 항목 색" 이라
     * 원래는 같아야 맞는데, 강조가 문서 순서와 반대로 들어가는 버그 덕분에
     * 우연히 통과하고 있었습니다. 의도대로 다시 씁니다.
     */
    /**
     * 강조는 **데코레이션**이라 다시 칠할 때마다 새 요소가 그려집니다.
     * 예전 span 은 제자리에서 색만 바뀌었지만 이제는 매번 다시 물어야 합니다.
     */
    const colors = (): string[] =>
      [...element.querySelectorAll<HTMLElement>('.find-highlight')].map(
        (el) => el.style.backgroundColor
      )

    it('should navigate to next match', () => {
      // Given: 강조 3개, 첫 번째가 현재 항목
      const before = colors()
      expect(before.length).toBe(3)
      expect(before[0]).not.toBe(before[1])

      // When: FIND_NEXT 이벤트 발행
      const result = eventBus.emit('FIND_NEXT')
      expect(result).toBe(true)

      // Then: 현재 항목이 두 번째로 옮겨가야 함
      const after = colors()
      expect(after[1]).toBe(before[0])
      expect(after[0]).toBe(before[1])
    })

    it('should wrap around to first match after last', () => {
      // Given: 두 번째, 세 번째 결과로 이동
      eventBus.emit('FIND_NEXT')
      eventBus.emit('FIND_NEXT')

      // When: 마지막에서 다음 이동
      const result = eventBus.emit('FIND_NEXT')

      // Then: 첫 번째 결과로 순환되어야 함
      expect(result).toBe(true)
    })

    it('should navigate to previous match', () => {
      // Given: FindReplacePlugin 등록됨

      // When: FIND_PREVIOUS 이벤트 발행
      const result = eventBus.emit('FIND_PREVIOUS')

      // Then: 이전 결과로 이동해야 함
      expect(result).toBe(true)
    })

    it('should wrap around to last match when going previous from first', () => {
      // Given: 첫 번째 결과에 있음

      // When: 이전 이동
      const result = eventBus.emit('FIND_PREVIOUS')

      // Then: 마지막 결과로 순환되어야 함
      expect(result).toBe(true)
    })

    it('should fail navigation when no matches', () => {
      // Given: 검색 결과 초기화
      eventBus.emit('CLEAR_FIND')

      // When: FIND_NEXT 이벤트 발행
      const result = eventBus.emit('FIND_NEXT')

      // Then: 실패해야 함
      expect(result).toBe(false)
    })

    /**
     * Why: 인덱스의 주인은 플러그인입니다. 되쏘지 않으면 화면이 같은 산술을
     *      직접 해야 하고, 실제로 UI 가 그렇게 하고 있었습니다.
     * How: 이동할 때마다 `STYLE_CHANGED` 의 `matchIndex` 를 확인
     */
    it('이동할 때마다 현재 인덱스를 실어 보내야 함', () => {
      // Given: 결과 3개에서 첫 번째가 선택된 상태
      const spy = vi.fn()
      eventBus.on('STYLE_CHANGED', spy)

      const indexOfLastCall = (): number =>
        spy.mock.calls[spy.mock.calls.length - 1][0].matchIndex

      // When/Then: 앞으로 돌면 0 → 1 → 2 → 0
      eventBus.emit('FIND_NEXT')
      expect(indexOfLastCall()).toBe(1)
      eventBus.emit('FIND_NEXT')
      expect(indexOfLastCall()).toBe(2)
      eventBus.emit('FIND_NEXT')
      expect(indexOfLastCall()).toBe(0)

      // 뒤로 돌면 0 → 2
      eventBus.emit('FIND_PREVIOUS')
      expect(indexOfLastCall()).toBe(2)
    })

    it('이동 통지에 전체 개수도 함께 실어야 함', () => {
      // Given: 결과 3개
      const spy = vi.fn()
      eventBus.on('STYLE_CHANGED', spy)

      // When: 다음으로 이동
      eventBus.emit('FIND_NEXT')

      // Then: 화면이 "2 of 3" 을 그리는 데 필요한 것이 한 번에 옵니다
      expect(spy).toHaveBeenCalledWith({
        style: 'find',
        action: 'next',
        matchCount: 3,
        matchIndex: 1,
      })
    })
  })

  describe('Replace functionality', () => {
    /**
     * Why: 사용자가 검색된 텍스트를 다른 텍스트로 치환할 수 있어야 함
     * How: `REPLACE` 이벤트 발행 시 현재 선택된 검색 결과를 치환하고
     *      다음 검색 결과로 이동
     */

    beforeEach(async () => {
      // Given: FindReplacePlugin 등록되고 검색 실행됨
      await pluginManager.register(FindReplacePlugin)
      area.setRawContent('<p>Hello World. Hello everyone.</p>')

      eventBus.emit('FIND', { query: 'Hello' })
    })

    it('should replace current match', () => {
      // Given: 이벤트 리스너 준비
      const styleChangedSpy = vi.fn()
      eventBus.on('STYLE_CHANGED', styleChangedSpy)

      const replaceData: ReplaceData = {
        query: 'Hello',
        replacement: 'Hi',
      }

      // When: REPLACE 이벤트 발행
      const result = eventBus.emit('REPLACE', replaceData)

      // Then: 현재 결과가 치환되고 남은 검색 결과 개수가 반환되어야 함
      expect(result).toBe(true)
      expect(styleChangedSpy).toHaveBeenCalledWith({
        style: 'find',
        action: 'replace',
        matchCount: 1,
        matchIndex: 0,
      })

      expect(element.textContent).toContain('Hi')

      vi.restoreAllMocks()
    })

    it('should fail replace without current match', () => {
      // Given: 검색 결과 초기화, console.warn spy 준비
      eventBus.emit('CLEAR_FIND')

      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})

      // When: REPLACE 이벤트 발행
      const result = eventBus.emit('REPLACE', {
        query: 'Hello',
        replacement: 'Hi',
      })

      // Then: 차단되고 경고가 출력되어야 함
      expect(result).toBe(false)
      expect(consoleWarn).toHaveBeenCalledWith(
        'Replace blocked: No current match'
      )

      consoleWarn.mockRestore()
    })

    it('should fail replace without replacement text', () => {
      // Given: console.warn spy 준비
      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})

      // When: 치환 텍스트 없이 REPLACE 이벤트 발행
      const result = eventBus.emit('REPLACE', { query: 'Hello' } as any)

      // Then: 차단되고 경고가 출력되어야 함
      expect(result).toBe(false)
      expect(consoleWarn).toHaveBeenCalledWith(
        'Replace blocked: Invalid replace data'
      )

      consoleWarn.mockRestore()
    })
  })

  describe('Replace all functionality', () => {
    /**
     * Why: 사용자가 모든 검색 결과를 한 번에 치환할 수 있어야 함
     * How: `REPLACE_ALL` 이벤트 발행 시 모든 검색 결과를 치환하고
     *      치환된 개수를 반환
     */

    beforeEach(async () => {
      // Given: FindReplacePlugin 등록됨
      await pluginManager.register(FindReplacePlugin)
      area.setRawContent('<p>Hello World. Hello everyone. Hello!</p>')
    })

    it('should replace all matches', () => {
      // Given: 이벤트 리스너 준비
      const styleChangedSpy = vi.fn()
      eventBus.on('STYLE_CHANGED', styleChangedSpy)

      const replaceData: ReplaceData = {
        query: 'Hello',
        replacement: 'Hi',
      }

      // When: REPLACE_ALL 이벤트 발행
      const result = eventBus.emit('REPLACE_ALL', replaceData)

      // Then: 모든 결과가 치환되어야 함
      expect(result).toBe(true)
      expect(styleChangedSpy).toHaveBeenCalledWith({
        style: 'find',
        action: 'replaceAll',
        replaceCount: 3,
        matchCount: 0,
        matchIndex: -1,
      })

      expect(element.textContent).not.toContain('Hello')
      expect(element.textContent).toContain('Hi World')
      expect(element.textContent).toContain('Hi everyone')
      expect(element.textContent).toContain('Hi!')

      vi.restoreAllMocks()
    })

    it('should replace all matches case-sensitively when specified', () => {
      // Given: 대소문자가 다른 텍스트로 HTML 변경
      area.setRawContent('<p>Hello hello HELLO</p>')

      const styleChangedSpy = vi.fn()
      eventBus.on('STYLE_CHANGED', styleChangedSpy)

      // When: 대소문자 구분 일괄 치환
      eventBus.emit('REPLACE_ALL', {
        query: 'hello',
        replacement: 'hi',
        caseSensitive: true,
      })

      // Then: 소문자 hello만 치환되어야 함
      expect(styleChangedSpy).toHaveBeenCalledWith({
        style: 'find',
        action: 'replaceAll',
        replaceCount: 1,
        matchCount: 0,
        matchIndex: -1,
      })

      expect(element.textContent).toContain('Hello')
      expect(element.textContent).toContain('hi')
      expect(element.textContent).toContain('HELLO')

      vi.restoreAllMocks()
    })

    it('should replace whole words only when specified', () => {
      // Given: 부분 일치 텍스트로 HTML 변경
      area.setRawContent('<p>Hello Helloworld</p>')

      const styleChangedSpy = vi.fn()
      eventBus.on('STYLE_CHANGED', styleChangedSpy)

      // When: 단어 단위 일괄 치환
      eventBus.emit('REPLACE_ALL', {
        query: 'Hello',
        replacement: 'Hi',
        wholeWord: true,
      })

      // Then: 단어 단위로만 일치하는 결과만 치환되어야 함
      expect(styleChangedSpy).toHaveBeenCalledWith({
        style: 'find',
        action: 'replaceAll',
        replaceCount: 1,
        matchCount: 0,
        matchIndex: -1,
      })

      expect(element.textContent).toContain('Hi')
      expect(element.textContent).toContain('Helloworld')

      vi.restoreAllMocks()
    })

    it('should handle replace all with no matches', () => {
      // Given: 이벤트 리스너 준비
      const styleChangedSpy = vi.fn()
      eventBus.on('STYLE_CHANGED', styleChangedSpy)

      // When: 존재하지 않는 텍스트 치환
      eventBus.emit('REPLACE_ALL', {
        query: 'nonexistent',
        replacement: 'something',
      })

      // Then: 치환 개수가 0이어야 함
      expect(styleChangedSpy).toHaveBeenCalledWith({
        style: 'find',
        action: 'replaceAll',
        replaceCount: 0,
        matchCount: 0,
        matchIndex: -1,
      })

      vi.restoreAllMocks()
    })

    it('should fail replace all without query or replacement', () => {
      // Given: console.warn spy 준비
      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})

      // When: 검색어 없이 REPLACE_ALL 이벤트 발행
      let result = eventBus.emit('REPLACE_ALL', { query: '' } as any)
      expect(result).toBe(false)

      // When: 치환 텍스트 없이 REPLACE_ALL 이벤트 발행
      result = eventBus.emit('REPLACE_ALL', { replacement: 'Hi' } as any)
      expect(result).toBe(false)

      // Then: 경고가 출력되어야 함
      expect(consoleWarn).toHaveBeenCalledWith(
        'Replace all blocked: Invalid replace data'
      )

      consoleWarn.mockRestore()
    })
  })

  describe('Clear find', () => {
    /**
     * Why: 사용자가 검색 하이라이트를 제거하고 검색 상태를 초기화할 수 있어야 함
     * How: `CLEAR_FIND` 이벤트 발행 시 모든 하이라이트를 제거하고
     *      원본 텍스트를 복원
     */

    beforeEach(async () => {
      // Given: FindReplacePlugin 등록되고 검색 실행됨
      await pluginManager.register(FindReplacePlugin)
      area.setRawContent('<p>Hello World. Hello everyone.</p>')

      eventBus.emit('FIND', { query: 'Hello' })
    })

    it('should clear all highlights', () => {
      // Given: 하이라이트 존재 확인
      let highlights = element.querySelectorAll('.find-highlight')
      expect(highlights.length).toBe(2)

      const styleChangedSpy = vi.fn()
      eventBus.on('STYLE_CHANGED', styleChangedSpy)

      // When: CLEAR_FIND 이벤트 발행
      const result = eventBus.emit('CLEAR_FIND')

      // Then: 하이라이트가 제거되고 이벤트가 발행되어야 함
      expect(result).toBe(true)
      expect(styleChangedSpy).toHaveBeenCalledWith({
        style: 'find',
        action: 'clear',
        matchCount: 0,
        matchIndex: -1,
      })

      highlights = element.querySelectorAll('.find-highlight')
      expect(highlights.length).toBe(0)

      vi.restoreAllMocks()
    })

    it('should restore original text content', () => {
      // Given: 원본 텍스트 저장
      const originalText = 'Hello World. Hello everyone.'

      // When: CLEAR_FIND 이벤트 발행
      eventBus.emit('CLEAR_FIND')

      // Then: 원본 텍스트가 복원되어야 함
      expect(element.textContent).toBe(originalText)
    })
  })

  describe('CJK/IME 입력 지원 (조합 문자 처리)', () => {
    /**
     * Why: 한글, 일본어 등 조합 문자 입력 중 검색/치환을 방지해야 함
     * How: `CompositionTracker.isComposing()`으로 조합 상태를 확인하고 차단
     */

    beforeEach(async () => {
      // Given: FindReplacePlugin 등록됨
      await pluginManager.register(FindReplacePlugin)
    })

    /**
     * Why: **찾기는 문서를 안 바꿉니다.**
     * How: 조합 가드는 문서를 고치는 길에 있습니다 (`runCommand` ·
     *      `runModelCommand`). 찾기는 읽고 화면에 칠할 뿐이라 지나가지
     *      않습니다 — 예전에는 플러그인마다 가드를 걸어서 이것까지 막고
     *      있었습니다.
     */
    it('찾기는 조합 중에도 됩니다 — 문서를 안 바꿉니다', () => {
      element.dispatchEvent(new CompositionEvent('compositionstart'))

      const result = eventBus.emit('FIND', { query: 'Hello' })

      expect(result).toBe(true)

      element.dispatchEvent(new CompositionEvent('compositionend'))
    })

    it('should block replace during IME composition', () => {
      // Given: 검색 실행, console.warn spy 준비, IME 조합 시작
      eventBus.emit('FIND', { query: 'Hello' })

      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})

      element.dispatchEvent(new CompositionEvent('compositionstart'))

      // When: 조합 중 REPLACE 이벤트 발행
      const result = eventBus.emit('REPLACE', {
        query: 'Hello',
        replacement: 'Hi',
      })

      // Then: 차단되고 경고가 출력되어야 함
      expect(result).toBe(false)
      expect(consoleWarn).toHaveBeenCalledWith(
        expect.stringContaining('IME composition in progress')
      )

      consoleWarn.mockRestore()
    })

    it('should block replace all during IME composition', () => {
      // Given: console.warn spy 준비, IME 조합 시작
      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})

      element.dispatchEvent(new CompositionEvent('compositionstart'))

      // When: 조합 중 REPLACE_ALL 이벤트 발행
      const result = eventBus.emit('REPLACE_ALL', {
        query: 'Hello',
        replacement: 'Hi',
      })

      // Then: 차단되고 경고가 출력되어야 함
      expect(result).toBe(false)
      expect(consoleWarn).toHaveBeenCalledWith(
        expect.stringContaining('IME composition in progress')
      )

      consoleWarn.mockRestore()
    })

    it('should allow operations after composition ends', () => {
      // Given: IME 조합 시작 후 종료
      element.dispatchEvent(new CompositionEvent('compositionstart'))
      element.dispatchEvent(new CompositionEvent('compositionend'))
      expect(composition.isComposing()).toBe(false)

      // When: 조합 종료 후 FIND 이벤트 발행
      const result = eventBus.emit('FIND', { query: 'Hello' })

      // Then: 정상 동작해야 함
      expect(result).toBe(true)
    })
  })

  describe('플러그인 생명주기 (초기화/정리)', () => {
    /**
     * Why: 플러그인 정리 시 이벤트 핸들러가 해제되고 하이라이트가 제거되어야 함
     * How: `destroy()` 호출 후 이벤트가 처리되지 않고 하이라이트가 제거되는지 확인
     */

    it('destroy 시 정리를 수행해야 함', async () => {
      // Given: FindReplacePlugin 등록되고 검색 실행됨
      await pluginManager.register(FindReplacePlugin)

      eventBus.emit('FIND', { query: 'Hello' })

      let highlights = element.querySelectorAll('.find-highlight')
      expect(highlights.length).toBe(2)

      // When: 플러그인 정리
      pluginManager.destroyAll()

      // Then: 하이라이트가 제거되어야 함
      highlights = element.querySelectorAll('.find-highlight')
      expect(highlights.length).toBe(0)

      // Then: 이벤트가 처리되지 않아야 함
      eventBus.emit('FIND', { query: 'World' })
      highlights = element.querySelectorAll('.find-highlight')
      expect(highlights.length).toBe(0)
    })
  })

  describe('실제 시나리오 (사용자 동작 시뮬레이션)', () => {
    /**
     * Why: 실제 사용자의 검색/치환 워크플로우를 검증
     * How: 검색, 탐색, 치환, 일괄 치환 등 다양한 시나리오를 테스트
     */

    beforeEach(async () => {
      // Given: FindReplacePlugin 등록됨
      await pluginManager.register(FindReplacePlugin)
    })

    it('should find, navigate, and replace workflow', () => {
      // Given: 검색할 텍스트로 HTML 설정
      area.setRawContent('<p>foo bar foo bar</p>')

      // When: 검색 실행
      eventBus.emit('FIND', { query: 'foo' })
      let highlights = element.querySelectorAll('.find-highlight')
      expect(highlights.length).toBe(2)

      // When: 다음 결과로 이동
      eventBus.emit('FIND_NEXT')

      // When: 하이라이트 제거 및 일괄 치환
      eventBus.emit('CLEAR_FIND')

      eventBus.emit('REPLACE_ALL', {
        query: 'foo',
        replacement: 'baz',
      })

      // Then: 모든 foo가 baz로 치환되어야 함
      expect(element.textContent).toBe('baz bar baz bar')

      // When: 추가 치환
      eventBus.emit('FIND', { query: 'bar' })
      highlights = element.querySelectorAll('.find-highlight')
      expect(highlights.length).toBe(2)

      eventBus.emit('REPLACE_ALL', {
        query: 'bar',
        replacement: 'qux',
      })

      // Then: 모든 bar가 qux로 치환되어야 함
      expect(element.textContent).toBe('baz qux baz qux')
    })

    it('should handle complex text with special characters', () => {
      // Given: 특수문자가 포함된 텍스트로 HTML 설정
      area.setRawContent('<p>Price: $100. Discount: 50%. Total: $50.</p>')

      const styleChangedSpy = vi.fn()
      eventBus.on('STYLE_CHANGED', styleChangedSpy)

      // When: 특수문자 검색
      eventBus.emit('FIND', { query: '$' })

      // Then: 특수문자가 검색되어야 함
      expect(styleChangedSpy).toHaveBeenCalledWith({
        style: 'find',
        action: 'find',
        matchCount: 2,
        matchIndex: 0,
      })

      // When: 일괄 치환
      eventBus.emit('REPLACE_ALL', {
        query: '$',
        replacement: 'USD ',
      })

      // Then: 특수문자가 치환되어야 함
      expect(element.textContent).toContain('USD 100')
      expect(element.textContent).toContain('USD 50')

      vi.restoreAllMocks()
    })

    it('should handle multiple find-replace cycles', () => {
      // Given: 치환할 텍스트로 HTML 설정
      area.setRawContent('<p>foo bar foo bar</p>')

      // When: 첫 번째 치환
      eventBus.emit('FIND', { query: 'foo' })
      eventBus.emit('REPLACE_ALL', {
        query: 'foo',
        replacement: 'baz',
      })

      // Then: foo가 baz로 치환되어야 함
      expect(element.textContent).toBe('baz bar baz bar')

      // When: 두 번째 치환
      eventBus.emit('FIND', { query: 'bar' })
      eventBus.emit('REPLACE_ALL', {
        query: 'bar',
        replacement: 'qux',
      })

      // Then: bar가 qux로 치환되어야 함
      expect(element.textContent).toBe('baz qux baz qux')
    })
  })
})
