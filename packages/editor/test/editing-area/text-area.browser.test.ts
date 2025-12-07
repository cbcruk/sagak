import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { TextArea } from '../../src/editing-area/modes/text-area'
import type { EditingAreaConfig } from '../../src/editing-area/types'

/**
 * TextArea 테스트
 *
 * Why: 순수 텍스트 편집을 위한 textarea 기반 영역 검증
 * How: textarea DOM 조작, HTML ↔ Text 변환 테스트
 */
describe('TextArea', () => {
  let container: HTMLDivElement
  let textArea: TextArea

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
  })

  afterEach(() => {
    if (textArea) {
      textArea.destroy()
    }
    document.body.removeChild(container)
  })

  describe('초기화 (textarea 생성)', () => {
    /**
     * Why: 순수 텍스트 편집을 위한 전용 textarea가 필요
     * How: `TextArea` 생성자로 textarea 요소 생성
     */

    it('textarea 요소를 생성해야 함', () => {
      // Given: 컨테이너가 포함된 config
      const config: EditingAreaConfig = { container }

      // When: TextArea 생성
      textArea = new TextArea(config)

      // Then: textarea 요소가 컨테이너에 추가됨
      const textarea = container.querySelector('textarea')
      expect(textarea).toBeDefined()
    })

    it('사용자 정의 className을 적용해야 함', () => {
      // Given: className이 지정된 config
      const config: EditingAreaConfig = {
        container,
        className: 'custom-text-area',
      }

      // When: TextArea 생성
      textArea = new TextArea(config)

      // Then: 사용자 정의 클래스가 적용됨
      const textarea = container.querySelector('textarea')
      expect(textarea?.className).toBe('custom-text-area')
    })

    it('minHeight를 적용해야 함', () => {
      // Given: minHeight가 지정된 config
      const config: EditingAreaConfig = {
        container,
        minHeight: 200,
      }

      // When: TextArea 생성
      textArea = new TextArea(config)

      // Then: minHeight 스타일이 적용됨
      const textarea = container.querySelector('textarea')
      expect(textarea?.style.minHeight).toBe('200px')
    })

    it('기본적으로 숨겨져 있어야 함', () => {
      // Given: 기본 config
      const config: EditingAreaConfig = { container }

      // When: TextArea 생성
      textArea = new TextArea(config)

      // Then: 숨김 상태로 생성됨
      expect(textArea.isVisible()).toBe(false)
      const textarea = container.querySelector('textarea')
      expect(textarea?.style.display).toBe('none')
    })
  })

  describe('콘텐츠 관리 (HTML ↔ Text 변환)', () => {
    /**
     * Why: 다른 모드와 콘텐츠를 주고받기 위해 HTML ↔ Text 변환이 필요
     * How: `HTMLConverter`로 `textToHTML()`/`htmlToText()` 변환
     */

    beforeEach(() => {
      const config: EditingAreaConfig = { container }
      textArea = new TextArea(config)
    })

    it('원시 콘텐츠를 설정하고 가져올 수 있어야 함', () => {
      // Given: 순수 텍스트

      // When: setRawContent로 설정
      textArea.setRawContent('Hello World')

      // Then: getRawContent로 동일한 값 조회
      expect(textArea.getRawContent()).toBe('Hello World')
    })

    it('콘텐츠를 HTML로 가져올 수 있어야 함', async () => {
      // Given: 텍스트가 설정된 상태
      textArea.setRawContent('Hello World')

      // When: getContent 호출
      const content = await textArea.getContent()

      // Then: HTML로 변환되어 반환됨
      expect(content).toBe('<p>Hello World</p>')
    })

    it('HTML로부터 콘텐츠를 설정할 수 있어야 함', async () => {
      // Given: HTML 문자열

      // When: setContent로 HTML 설정
      await textArea.setContent('<p>Hello World</p>')

      // Then: 텍스트로 변환되어 저장됨
      expect(textArea.getRawContent()).toBe('Hello World')
    })

    it('여러 줄 콘텐츠를 처리해야 함', async () => {
      // Given: 여러 줄 텍스트
      const text = 'Line 1\nLine 2\nLine 3'
      textArea.setRawContent(text)

      // When: getContent 호출
      const html = await textArea.getContent()

      // Then: 각 줄이 p 태그로 변환됨
      expect(html).toContain('<p>Line 1</p>')
      expect(html).toContain('<p>Line 2</p>')
      expect(html).toContain('<p>Line 3</p>')
    })

    it('HTML을 텍스트로 변환해야 함', async () => {
      // Given: 여러 p 태그로 구성된 HTML
      const html = '<p>Line 1</p><p>Line 2</p>'

      // When: setContent로 HTML 설정
      await textArea.setContent(html)

      // Then: 줄 바꿈으로 구분된 텍스트로 변환됨
      const rawContent = textArea.getRawContent()
      expect(rawContent).toBe('Line 1\nLine 2')
    })

    it('HTML 태그를 제거해야 함', async () => {
      // Given: 서식 태그가 포함된 HTML
      const html = '<p>Hello <strong>World</strong></p>'

      // When: setContent로 HTML 설정
      await textArea.setContent(html)

      // Then: 태그가 제거된 순수 텍스트로 변환됨
      const rawContent = textArea.getRawContent()
      expect(rawContent).toBe('Hello World')
    })

    it('빈 콘텐츠를 처리해야 함', async () => {
      // Given: 빈 문자열

      // When: setContent로 빈 콘텐츠 설정
      await textArea.setContent('')

      // Then: 빈 문자열이 저장됨
      expect(textArea.getRawContent()).toBe('')
    })

    it('빈 HTML을 처리해야 함', async () => {
      // Given: 빈 p 태그

      // When: setContent로 빈 HTML 설정
      await textArea.setContent('<p><br></p>')

      // Then: 빈 문자열로 변환됨
      expect(textArea.getRawContent()).toBe('')
    })
  })

  describe('표시 관리 (show/hide)', () => {
    /**
     * Why: 모드 전환 시 텍스트 영역을 표시하거나 숨겨야 함
     * How: `show()`/`hide()`로 display 스타일 제어
     */

    beforeEach(() => {
      const config: EditingAreaConfig = { container }
      textArea = new TextArea(config)
    })

    it('텍스트 영역을 표시해야 함', async () => {
      // Given: 숨겨진 상태의 TextArea

      // When: show 호출
      await textArea.show()

      // Then: 표시 상태로 변경됨
      expect(textArea.isVisible()).toBe(true)
      const textarea = container.querySelector('textarea')
      expect(textarea?.style.display).toBe('block')
    })

    it('텍스트 영역을 숨겨야 함', async () => {
      // Given: 표시된 상태의 TextArea
      await textArea.show()

      // When: hide 호출
      await textArea.hide()

      // Then: 숨김 상태로 변경됨
      expect(textArea.isVisible()).toBe(false)
      const textarea = container.querySelector('textarea')
      expect(textarea?.style.display).toBe('none')
    })
  })

  describe('포커스 관리 (textarea focus)', () => {
    /**
     * Why: 텍스트 편집 시 사용자가 바로 타이핑을 시작할 수 있어야 함
     * How: `focus()`로 textarea에 포커스, 커서 위치 설정
     */

    beforeEach(() => {
      const config: EditingAreaConfig = { container }
      textArea = new TextArea(config)
    })

    it('textarea에 포커스를 설정해야 함', () => {
      // Given: 표시된 TextArea
      textArea.show()

      // When: focus 호출
      textArea.focus()

      // Then: textarea가 활성 요소임
      const textarea = container.querySelector('textarea')
      expect(document.activeElement).toBe(textarea)
    })

    it('포커스 시 커서를 시작 위치로 설정해야 함', () => {
      // Given: 콘텐츠가 있는 TextArea
      textArea.setRawContent('Hello World')

      // When: focus 호출
      textArea.focus()

      // Then: 커서가 시작 위치에 있음
      const textarea = container.querySelector(
        'textarea'
      ) as HTMLTextAreaElement
      expect(textarea.selectionStart).toBe(0)
      expect(textarea.selectionEnd).toBe(0)
    })
  })

  describe('편집 가능 상태 (disabled 제어)', () => {
    /**
     * Why: 읽기 전용 모드에서 편집을 방지해야 함
     * How: `setEditable()`로 textarea disabled 속성 변경
     */

    beforeEach(() => {
      const config: EditingAreaConfig = { container }
      textArea = new TextArea(config)
    })

    it('기본적으로 편집이 활성화되어야 함', () => {
      // Given: 생성된 TextArea

      // When: disabled 속성 확인

      // Then: disabled가 false임
      const textarea = container.querySelector(
        'textarea'
      ) as HTMLTextAreaElement
      expect(textarea.disabled).toBe(false)
    })

    it('편집을 비활성화할 수 있어야 함', () => {
      // Given: 생성된 TextArea

      // When: setEditable(false) 호출
      textArea.setEditable(false)

      // Then: disabled가 true로 변경됨
      const textarea = container.querySelector(
        'textarea'
      ) as HTMLTextAreaElement
      expect(textarea.disabled).toBe(true)
    })

    it('편집을 활성화할 수 있어야 함', () => {
      // Given: 편집이 비활성화된 TextArea
      textArea.setEditable(false)

      // When: setEditable(true) 호출
      textArea.setEditable(true)

      // Then: disabled가 false로 변경됨
      const textarea = container.querySelector(
        'textarea'
      ) as HTMLTextAreaElement
      expect(textarea.disabled).toBe(false)
    })
  })

  describe('요소 접근 (getElement)', () => {
    /**
     * Why: 외부에서 textarea 요소에 직접 접근해야 하는 경우가 있음
     * How: `getElement()`로 textarea 요소 반환
     */

    beforeEach(() => {
      const config: EditingAreaConfig = { container }
      textArea = new TextArea(config)
    })

    it('textarea 요소를 반환해야 함', () => {
      // Given: 생성된 TextArea

      // When: getElement 호출
      const element = textArea.getElement()

      // Then: HTMLTextAreaElement 인스턴스가 반환됨
      expect(element).toBeInstanceOf(HTMLTextAreaElement)
      expect(element.tagName).toBe('TEXTAREA')
    })
  })

  describe('리소스 정리 (destroy)', () => {
    /**
     * Why: 메모리 누수를 방지하기 위해 리소스를 정리해야 함
     * How: `destroy()`로 DOM에서 textarea 제거
     */

    it('destroy 시 textarea를 제거해야 함', () => {
      // Given: 생성된 TextArea
      const config: EditingAreaConfig = { container }
      textArea = new TextArea(config)

      const textarea = container.querySelector('textarea')
      expect(textarea).toBeDefined()

      // When: destroy 호출
      textArea.destroy()

      // Then: textarea가 DOM에서 제거됨
      const afterDestroy = container.querySelector('textarea')
      expect(afterDestroy).toBeNull()
    })
  })

  describe('왕복 변환 (Text ↔ HTML 보존)', () => {
    /**
     * Why: Text ↔ HTML 변환 시 콘텐츠가 손실되면 안 됨
     * How: text → HTML → text 변환 시 원본 보존 확인
     */

    beforeEach(() => {
      const config: EditingAreaConfig = { container }
      textArea = new TextArea(config)
    })

    it('HTML 변환을 통해 순수 텍스트를 보존해야 함', async () => {
      // Given: 여러 줄 텍스트
      const originalText = 'Hello World\nLine 2'
      textArea.setRawContent(originalText)

      // When: Text → HTML → Text 왕복 변환
      const html = await textArea.getContent()
      await textArea.setContent(html)

      // Then: 원본 텍스트가 보존됨
      expect(textArea.getRawContent()).toBe(originalText)
    })

    it('특수 문자를 보존해야 함', async () => {
      // Given: 특수 문자가 포함된 텍스트
      const originalText = 'Test & <special> "characters"'
      textArea.setRawContent(originalText)

      // When: Text → HTML → Text 왕복 변환
      const html = await textArea.getContent()
      await textArea.setContent(html)

      // Then: 특수 문자가 보존됨
      expect(textArea.getRawContent()).toBe(originalText)
    })

    it('빈 줄을 보존해야 함', async () => {
      // Given: 빈 줄이 포함된 텍스트
      const originalText = 'Line 1\n\nLine 3'
      textArea.setRawContent(originalText)

      // When: Text → HTML → Text 왕복 변환
      const html = await textArea.getContent()
      await textArea.setContent(html)

      // Then: 빈 줄이 보존됨
      expect(textArea.getRawContent()).toBe(originalText)
    })
  })

  describe('자동 크기 조정 (autoResize)', () => {
    /**
     * Why: 콘텐츠 양에 따라 textarea 높이가 자동 조정되면 편집이 편리함
     * How: autoResize 옵션으로 콘텐츠에 따라 textarea 높이 자동 조정
     */

    it('autoResize 옵션을 지원해야 함', () => {
      // Given: autoResize가 활성화된 config
      const config: EditingAreaConfig = {
        container,
        autoResize: true,
      }

      // When: TextArea 생성
      // Then: 오류 없이 생성됨
      expect(() => {
        textArea = new TextArea(config)
      }).not.toThrow()
    })
  })
})
