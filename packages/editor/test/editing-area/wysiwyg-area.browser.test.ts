import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { WysiwygArea } from '../../src/editing-area/modes/wysiwyg-area'
import { SelectionManager } from '@sagak/core/selection-manager'
import { EventBus } from '@sagak/core/event-bus'
import type { WysiwygAreaConfig } from '../../src/editing-area/modes/wysiwyg-area'

/**
 * WysiwygArea 테스트
 *
 * Why: contentEditable 기반 WYSIWYG 편집 영역의 기능 검증
 * How: DOM 조작, 이벤트 처리, SelectionManager 통합 테스트
 */
describe('WysiwygArea', () => {
  let container: HTMLDivElement
  let wysiwygArea: WysiwygArea

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
  })

  afterEach(() => {
    if (wysiwygArea) {
      wysiwygArea.destroy()
    }
    document.body.removeChild(container)
  })

  describe('초기화 (편집 영역 설정)', () => {
    /**
     * Why: 사용자가 리치 텍스트를 편집할 수 있는 WYSIWYG 영역이 필요
     * How: `WysiwygArea` 생성자로 contentEditable div 생성, iframe 사용 안함
     */

    it('contentEditable div를 생성해야 함', () => {
      // Given: 컨테이너가 포함된 config
      const config: WysiwygAreaConfig = { container }

      // When: WysiwygArea 생성
      wysiwygArea = new WysiwygArea(config)

      // Then: contentEditable이 true인 div가 생성됨
      const div = container.querySelector('div')
      expect(div).toBeDefined()
      expect(div?.contentEditable).toBe('true')
    })

    it('iframe를 사용하지 않아야 함', () => {
      // Given: 기본 config
      const config: WysiwygAreaConfig = { container }

      // When: WysiwygArea 생성
      wysiwygArea = new WysiwygArea(config)

      // Then: iframe이 생성되지 않음 (최신 접근 방식)
      const iframe = container.querySelector('iframe')
      expect(iframe).toBeNull()
    })

    it('사용자 정의 className을 적용해야 함', () => {
      // Given: className이 지정된 config
      const config: WysiwygAreaConfig = {
        container,
        className: 'custom-wysiwyg',
      }

      // When: WysiwygArea 생성
      wysiwygArea = new WysiwygArea(config)

      // Then: 사용자 정의 클래스가 적용됨
      const div = wysiwygArea.getElement()
      expect(div.className).toBe('custom-wysiwyg')
    })

    it('minHeight를 적용해야 함', () => {
      // Given: minHeight가 지정된 config
      const config: WysiwygAreaConfig = {
        container,
        minHeight: 400,
      }

      // When: WysiwygArea 생성
      wysiwygArea = new WysiwygArea(config)

      // Then: minHeight 스타일이 적용됨
      const div = wysiwygArea.getElement()
      expect(div.style.minHeight).toBe('400px')
    })

    it('기본적으로 숨겨져 있어야 함', () => {
      // Given: 기본 config
      const config: WysiwygAreaConfig = { container }

      // When: WysiwygArea 생성
      wysiwygArea = new WysiwygArea(config)

      // Then: 숨김 상태로 생성됨
      expect(wysiwygArea.isVisible()).toBe(false)
      const div = wysiwygArea.getElement()
      expect(div.style.display).toBe('none')
    })

    it('기본 콘텐츠를 가져야 함', () => {
      // Given: 기본 config
      const config: WysiwygAreaConfig = { container }

      // When: WysiwygArea 생성
      wysiwygArea = new WysiwygArea(config)

      // Then: 빈 p 태그가 기본 콘텐츠로 설정됨
      const content = wysiwygArea.getRawContent()
      expect(content).toBe('<p><br></p>')
    })
  })

  describe('콘텐츠 관리 (HTML 저장 및 조회)', () => {
    /**
     * Why: WYSIWYG 편집 결과를 HTML 형식으로 저장하고 조회해야 함
     * How: `setContent()`/`getContent()`로 IR 형식(HTML) 저장/조회, 빈 콘텐츠 정규화
     */

    beforeEach(() => {
      const config: WysiwygAreaConfig = { container }
      wysiwygArea = new WysiwygArea(config)
    })

    it('원시 콘텐츠를 설정하고 가져올 수 있어야 함', () => {
      // Given: HTML 문자열

      // When: setRawContent로 설정
      wysiwygArea.setRawContent('<p>Hello World</p>')

      // Then: getRawContent로 동일한 값 조회
      expect(wysiwygArea.getRawContent()).toBe('<p>Hello World</p>')
    })

    it('콘텐츠를 HTML로 가져올 수 있어야 함', async () => {
      // Given: HTML이 설정된 상태
      wysiwygArea.setRawContent('<p>Hello World</p>')

      // When: getContent 호출
      const content = await wysiwygArea.getContent()

      // Then: 설정한 HTML이 반환됨
      expect(content).toBe('<p>Hello World</p>')
    })

    it('HTML로부터 콘텐츠를 설정할 수 있어야 함', async () => {
      // Given: HTML 문자열

      // When: setContent로 HTML 설정
      await wysiwygArea.setContent('<p>Hello World</p>')

      // Then: 설정한 HTML이 저장됨
      expect(wysiwygArea.getRawContent()).toBe('<p>Hello World</p>')
    })

    it('빈 콘텐츠를 처리해야 함', async () => {
      // Given: 빈 문자열

      // When: setContent로 빈 콘텐츠 설정
      await wysiwygArea.setContent('')

      // Then: 기본 빈 p 태그로 정규화됨
      const content = wysiwygArea.getRawContent()
      expect(content).toBe('<p><br></p>')
    })

    it('<br>을 빈 콘텐츠로 처리해야 함', async () => {
      // Given: br 태그만 있는 HTML

      // When: setContent로 설정
      await wysiwygArea.setContent('<br>')

      // Then: 기본 빈 p 태그로 정규화됨
      const content = wysiwygArea.getRawContent()
      expect(content).toBe('<p><br></p>')
    })

    it('<p></p>를 빈 콘텐츠로 처리해야 함', async () => {
      // Given: 빈 p 태그

      // When: setContent로 설정
      await wysiwygArea.setContent('<p></p>')

      // Then: br이 포함된 p 태그로 정규화됨
      const content = wysiwygArea.getRawContent()
      expect(content).toBe('<p><br></p>')
    })

    it('리치 콘텐츠를 보존해야 함', async () => {
      // Given: 서식 태그가 포함된 HTML
      const html = '<p>Hello <strong>World</strong></p>'

      // When: setContent로 설정
      await wysiwygArea.setContent(html)

      // Then: 서식이 보존됨
      expect(wysiwygArea.getRawContent()).toBe(html)
    })

    it('여러 단락을 보존해야 함', async () => {
      // Given: 여러 p 태그로 구성된 HTML
      const html = '<p>Paragraph 1</p><p>Paragraph 2</p>'

      // When: setContent로 설정
      await wysiwygArea.setContent(html)

      // Then: 단락 구조가 보존됨
      expect(wysiwygArea.getRawContent()).toBe(html)
    })
  })

  describe('표시 관리 (show/hide 동작)', () => {
    /**
     * Why: 모드 전환 시 WYSIWYG 영역을 표시하거나 숨겨야 함
     * How: `show()`/`hide()`로 display 스타일 제어, `EventBus`로 이벤트 발행
     */

    beforeEach(() => {
      const config: WysiwygAreaConfig = { container }
      wysiwygArea = new WysiwygArea(config)
    })

    it('WYSIWYG 영역을 표시해야 함', async () => {
      // Given: 숨겨진 상태의 WysiwygArea

      // When: show 호출
      await wysiwygArea.show()

      // Then: 표시 상태로 변경됨
      expect(wysiwygArea.isVisible()).toBe(true)
      const div = wysiwygArea.getElement()
      expect(div.style.display).toBe('block')
    })

    it('WYSIWYG 영역을 숨겨야 함', async () => {
      // Given: 표시된 상태의 WysiwygArea
      await wysiwygArea.show()

      // When: hide 호출
      await wysiwygArea.hide()

      // Then: 숨김 상태로 변경됨
      expect(wysiwygArea.isVisible()).toBe(false)
      const div = wysiwygArea.getElement()
      expect(div.style.display).toBe('none')
    })

    it('show 시 이벤트를 발행해야 함', async () => {
      // Given: EventBus와 SHOWN 핸들러가 설정된 WysiwygArea
      const eventBus = new EventBus()
      const handler = vi.fn()
      eventBus.on('WYSIWYG_AREA_SHOWN', 'on', handler)

      const config: WysiwygAreaConfig = { container, eventBus }
      wysiwygArea = new WysiwygArea(config)

      // When: show 호출
      await wysiwygArea.show()

      // Then: WYSIWYG_AREA_SHOWN 이벤트가 발행됨
      expect(handler).toHaveBeenCalled()
    })

    it('hide 시 이벤트를 발행해야 함', async () => {
      // Given: EventBus와 HIDDEN 핸들러가 설정된 WysiwygArea
      const eventBus = new EventBus()
      const handler = vi.fn()
      eventBus.on('WYSIWYG_AREA_HIDDEN', 'on', handler)

      const config: WysiwygAreaConfig = { container, eventBus }
      wysiwygArea = new WysiwygArea(config)

      await wysiwygArea.show()

      // When: hide 호출
      await wysiwygArea.hide()

      // Then: WYSIWYG_AREA_HIDDEN 이벤트가 발행됨
      expect(handler).toHaveBeenCalled()
    })
  })

  describe('포커스 관리 (focus 제어)', () => {
    /**
     * Why: 사용자가 WYSIWYG 영역에서 바로 편집을 시작할 수 있어야 함
     * How: `focus()` 메서드로 contentEditable div에 포커스
     */

    beforeEach(() => {
      const config: WysiwygAreaConfig = { container }
      wysiwygArea = new WysiwygArea(config)
    })

    it('요소에 포커스를 설정해야 함', () => {
      // Given: 생성된 WysiwygArea

      // When: focus 호출
      // Then: 오류 없이 실행됨
      expect(() => {
        wysiwygArea.focus()
      }).not.toThrow()
    })
  })

  describe('편집 가능 상태 (contentEditable 제어)', () => {
    /**
     * Why: 읽기 전용 모드에서 편집을 방지해야 함
     * How: `setEditable()`로 contentEditable 속성 변경
     */

    beforeEach(() => {
      const config: WysiwygAreaConfig = { container }
      wysiwygArea = new WysiwygArea(config)
    })

    it('기본적으로 편집 가능해야 함', () => {
      // Given: 생성된 WysiwygArea

      // When: contentEditable 속성 확인

      // Then: contentEditable이 'true'임
      const div = wysiwygArea.getElement()
      expect(div.contentEditable).toBe('true')
    })

    it('편집을 비활성화할 수 있어야 함', () => {
      // Given: 생성된 WysiwygArea

      // When: setEditable(false) 호출
      wysiwygArea.setEditable(false)

      // Then: contentEditable이 'false'로 변경됨
      const div = wysiwygArea.getElement()
      expect(div.contentEditable).toBe('false')
    })

    it('편집을 활성화할 수 있어야 함', () => {
      // Given: 편집이 비활성화된 WysiwygArea
      wysiwygArea.setEditable(false)

      // When: setEditable(true) 호출
      wysiwygArea.setEditable(true)

      // Then: contentEditable이 'true'로 변경됨
      const div = wysiwygArea.getElement()
      expect(div.contentEditable).toBe('true')
    })
  })

  describe('요소 접근 (getElement)', () => {
    /**
     * Why: 외부에서 contentEditable 요소에 직접 접근해야 하는 경우가 있음
     * How: `getElement()`로 contentEditable div 반환
     */

    beforeEach(() => {
      const config: WysiwygAreaConfig = { container }
      wysiwygArea = new WysiwygArea(config)
    })

    it('contentEditable 요소를 반환해야 함', () => {
      // Given: 생성된 WysiwygArea

      // When: getElement 호출
      const element = wysiwygArea.getElement()

      // Then: contentEditable이 true인 HTMLDivElement가 반환됨
      expect(element).toBeInstanceOf(HTMLDivElement)
      expect(element.contentEditable).toBe('true')
    })
  })

  describe('명령 실행 (execCommand)', () => {
    /**
     * Why: 사용자가 서식(bold, italic 등)을 적용할 수 있어야 함
     * How: `execCommand()`로 document.execCommand 실행
     */

    beforeEach(() => {
      const config: WysiwygAreaConfig = { container }
      wysiwygArea = new WysiwygArea(config)
    })

    it('bold 명령을 실행해야 함', () => {
      // Given: 텍스트가 선택된 상태의 WysiwygArea
      wysiwygArea.show()
      wysiwygArea.focus()

      const element = wysiwygArea.getElement()
      element.innerHTML = '<p>Hello World</p>'
      const textNode = element.firstChild!.firstChild as Text
      const range = document.createRange()
      range.setStart(textNode, 0)
      range.setEnd(textNode, 5)

      const selection = window.getSelection()!
      selection.removeAllRanges()
      selection.addRange(range)

      // When: bold 명령 실행
      const result = wysiwygArea.execCommand('bold')

      // Then: 명령이 성공적으로 실행됨
      expect(result).toBe(true)
    })

    it('italic 명령을 실행해야 함', () => {
      // Given: 텍스트가 선택된 상태의 WysiwygArea
      wysiwygArea.show()
      wysiwygArea.focus()

      const element = wysiwygArea.getElement()
      element.innerHTML = '<p>Hello World</p>'
      const textNode = element.firstChild!.firstChild as Text
      const range = document.createRange()
      range.setStart(textNode, 0)
      range.setEnd(textNode, 5)

      const selection = window.getSelection()!
      selection.removeAllRanges()
      selection.addRange(range)

      // When: italic 명령 실행
      const result = wysiwygArea.execCommand('italic')

      // Then: 명령이 성공적으로 실행됨
      expect(result).toBe(true)
    })

    it('값이 있는 명령을 실행해야 함', () => {
      // Given: 텍스트가 선택된 상태의 WysiwygArea
      wysiwygArea.show()
      wysiwygArea.focus()

      const element = wysiwygArea.getElement()
      element.innerHTML = '<p>Hello World</p>'
      const textNode = element.firstChild!.firstChild as Text
      const range = document.createRange()
      range.setStart(textNode, 0)
      range.setEnd(textNode, 5)

      const selection = window.getSelection()!
      selection.removeAllRanges()
      selection.addRange(range)

      // When: foreColor 명령을 값과 함께 실행
      const result = wysiwygArea.execCommand('foreColor', 'red')

      // Then: 명령이 성공적으로 실행됨
      expect(result).toBe(true)
    })
  })

  describe('SelectionManager 통합 (CJK/IME 지원)', () => {
    /**
     * Why: 한글 등 CJK 입력과 IME 조합 중 선택 영역 처리를 개선해야 함
     * How: `SelectionManager`를 사용하여 한글 입력, 선택 영역 관리 개선
     */

    it('insertHTML에 SelectionManager를 사용해야 함', () => {
      // Given: SelectionManager가 설정된 WysiwygArea
      const editableDiv = document.createElement('div')
      editableDiv.contentEditable = 'true'
      document.body.appendChild(editableDiv)

      const selectionManager = new SelectionManager(editableDiv)
      const config: WysiwygAreaConfig = {
        container,
        selectionManager,
      }
      wysiwygArea = new WysiwygArea(config)

      // When: insertHTML 호출
      const result = wysiwygArea.insertHTML('<strong>Bold</strong>')

      // Then: 결과가 반환됨
      expect(result).toBeDefined()

      document.body.removeChild(editableDiv)
    })

    it('insertText에 SelectionManager를 사용해야 함', () => {
      // Given: SelectionManager가 설정된 WysiwygArea
      const editableDiv = document.createElement('div')
      editableDiv.contentEditable = 'true'
      document.body.appendChild(editableDiv)

      const selectionManager = new SelectionManager(editableDiv)
      const config: WysiwygAreaConfig = {
        container,
        selectionManager,
      }
      wysiwygArea = new WysiwygArea(config)

      // When: insertText 호출
      const result = wysiwygArea.insertText('Hello')

      // Then: 결과가 반환됨
      expect(result).toBeDefined()

      document.body.removeChild(editableDiv)
    })

    it('IME 입력 상태를 확인해야 함', () => {
      // Given: SelectionManager가 설정된 WysiwygArea
      const editableDiv = document.createElement('div')
      editableDiv.contentEditable = 'true'
      document.body.appendChild(editableDiv)

      const selectionManager = new SelectionManager(editableDiv)
      const config: WysiwygAreaConfig = {
        container,
        selectionManager,
      }
      wysiwygArea = new WysiwygArea(config)

      // When: isComposing 호출
      const isComposing = wysiwygArea.isComposing()

      // Then: boolean 타입의 값이 반환됨
      expect(typeof isComposing).toBe('boolean')

      document.body.removeChild(editableDiv)
    })

    it('선택 영역을 저장하고 복원해야 함', () => {
      // Given: SelectionManager가 설정된 WysiwygArea
      const editableDiv = document.createElement('div')
      editableDiv.contentEditable = 'true'
      document.body.appendChild(editableDiv)

      const selectionManager = new SelectionManager(editableDiv)
      const config: WysiwygAreaConfig = {
        container,
        selectionManager,
      }
      wysiwygArea = new WysiwygArea(config)

      // When: saveSelection → restoreSelection 호출
      // Then: 오류 없이 실행됨
      expect(() => {
        wysiwygArea.saveSelection()
        wysiwygArea.restoreSelection()
      }).not.toThrow()

      document.body.removeChild(editableDiv)
    })
  })

  describe('이벤트 발행 (EventBus 통합)', () => {
    /**
     * Why: WYSIWYG 영역의 변경 사항을 다른 컴포넌트에 알려야 함
     * How: DOM 이벤트 리스너로 이벤트 포착 후 `EventBus`로 발행
     */

    it('콘텐츠 변경 이벤트를 발행해야 함', () => {
      // Given: EventBus와 CONTENT_CHANGED 핸들러가 설정된 WysiwygArea
      const eventBus = new EventBus()
      const handler = vi.fn()
      eventBus.on('WYSIWYG_CONTENT_CHANGED', 'on', handler)

      const config: WysiwygAreaConfig = { container, eventBus }
      wysiwygArea = new WysiwygArea(config)

      // When: input 이벤트 발생
      const div = wysiwygArea.getElement()
      div.dispatchEvent(new Event('input', { bubbles: true }))

      // Then: WYSIWYG_CONTENT_CHANGED 이벤트가 발행됨
      expect(handler).toHaveBeenCalled()
    })

    it('포커스 이벤트를 발행해야 함', () => {
      // Given: EventBus와 FOCUSED 핸들러가 설정된 WysiwygArea
      const eventBus = new EventBus()
      const handler = vi.fn()
      eventBus.on('WYSIWYG_FOCUSED', 'on', handler)

      const config: WysiwygAreaConfig = { container, eventBus }
      wysiwygArea = new WysiwygArea(config)

      // When: focus 이벤트 발생
      const div = wysiwygArea.getElement()
      div.dispatchEvent(new Event('focus', { bubbles: true }))

      // Then: WYSIWYG_FOCUSED 이벤트가 발행됨
      expect(handler).toHaveBeenCalled()
    })

    it('블러 이벤트를 발행해야 함', () => {
      // Given: EventBus와 BLURRED 핸들러가 설정된 WysiwygArea
      const eventBus = new EventBus()
      const handler = vi.fn()
      eventBus.on('WYSIWYG_BLURRED', 'on', handler)

      const config: WysiwygAreaConfig = { container, eventBus }
      wysiwygArea = new WysiwygArea(config)

      // When: blur 이벤트 발생
      const div = wysiwygArea.getElement()
      div.dispatchEvent(new Event('blur', { bubbles: true }))

      // Then: WYSIWYG_BLURRED 이벤트가 발행됨
      expect(handler).toHaveBeenCalled()
    })

    it('키다운 이벤트를 발행해야 함', () => {
      // Given: EventBus와 KEYDOWN 핸들러가 설정된 WysiwygArea
      const eventBus = new EventBus()
      const handler = vi.fn()
      eventBus.on('WYSIWYG_KEYDOWN', 'on', handler)

      const config: WysiwygAreaConfig = { container, eventBus }
      wysiwygArea = new WysiwygArea(config)

      // When: keydown 이벤트 발생
      const div = wysiwygArea.getElement()
      div.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }))

      // Then: WYSIWYG_KEYDOWN 이벤트가 발행됨
      expect(handler).toHaveBeenCalled()
    })
  })

  describe('리소스 정리 (destroy)', () => {
    /**
     * Why: 메모리 누수를 방지하기 위해 리소스를 정리해야 함
     * How: `destroy()`로 DOM에서 요소 제거
     */

    it('destroy 시 요소를 제거해야 함', () => {
      // Given: 생성된 WysiwygArea
      const config: WysiwygAreaConfig = { container }
      wysiwygArea = new WysiwygArea(config)

      const element = wysiwygArea.getElement()
      expect(element.parentNode).toBe(container)

      // When: destroy 호출
      wysiwygArea.destroy()

      // Then: 요소가 DOM에서 제거됨
      expect(element.parentNode).toBeNull()
    })
  })

  describe('자동 크기 조정 (autoResize)', () => {
    /**
     * Why: 콘텐츠 양에 따라 편집 영역 높이가 자동 조정되면 편집이 편리함
     * How: ResizeObserver로 콘텐츠에 따라 자동 크기 조정
     */

    it('autoResize 옵션을 지원해야 함', () => {
      // Given: autoResize가 활성화된 config
      const config: WysiwygAreaConfig = {
        container,
        autoResize: true,
      }

      // When: WysiwygArea 생성
      // Then: 오류 없이 생성됨
      expect(() => {
        wysiwygArea = new WysiwygArea(config)
      }).not.toThrow()
    })
  })

  describe('선택 영역 작업 (getSelectedText/HTML)', () => {
    /**
     * Why: 선택된 콘텐츠를 기반으로 서식 적용이나 복사 기능을 구현해야 함
     * How: `window.getSelection()` 또는 `SelectionManager`로 선택 영역 조회
     */

    beforeEach(() => {
      const config: WysiwygAreaConfig = { container }
      wysiwygArea = new WysiwygArea(config)
    })

    it('선택된 텍스트를 가져와야 함', () => {
      // Given: 콘텐츠가 있는 WysiwygArea
      wysiwygArea.setRawContent('<p>Hello World</p>')

      // When: getSelectedText 호출
      const text = wysiwygArea.getSelectedText()

      // Then: 문자열이 반환됨
      expect(typeof text).toBe('string')
    })

    it('선택된 HTML을 가져와야 함', () => {
      // Given: 콘텐츠가 있는 WysiwygArea
      wysiwygArea.setRawContent('<p>Hello World</p>')

      // When: getSelectedHTML 호출
      const html = wysiwygArea.getSelectedHTML()

      // Then: 문자열이 반환됨
      expect(typeof html).toBe('string')
    })
  })
})
