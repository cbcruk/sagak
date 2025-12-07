import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { HtmlSourceArea } from '../../src/editing-area/modes/html-source-area'
import type { EditingAreaConfig } from '../../src/editing-area/types'

/**
 * HtmlSourceArea 테스트
 *
 * Why: HTML 소스 코드 직접 편집을 위한 textarea 기반 영역 검증
 * How: textarea DOM 조작, HTML 포맷팅/압축/정리, 탭 키 지원 테스트
 */
describe('HtmlSourceArea', () => {
  let container: HTMLDivElement
  let htmlSourceArea: HtmlSourceArea

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
  })

  afterEach(() => {
    if (htmlSourceArea) {
      htmlSourceArea.destroy()
    }
    document.body.removeChild(container)
  })

  describe('초기화 (textarea 생성)', () => {
    /**
     * Why: HTML 소스 편집을 위한 전용 textarea가 필요
     * How: `HtmlSourceArea` 생성자로 textarea 요소 생성 및 monospace 스타일 적용
     */

    it('textarea 요소를 생성해야 함', () => {
      // Given: 컨테이너가 포함된 config
      const config: EditingAreaConfig = { container }

      // When: HtmlSourceArea 생성
      htmlSourceArea = new HtmlSourceArea(config)

      // Then: textarea 요소가 컨테이너에 추가됨
      const textarea = container.querySelector('textarea')
      expect(textarea).toBeDefined()
    })

    it('사용자 정의 className을 적용해야 함', () => {
      // Given: className이 지정된 config
      const config: EditingAreaConfig = {
        container,
        className: 'custom-html-source',
      }

      // When: HtmlSourceArea 생성
      htmlSourceArea = new HtmlSourceArea(config)

      // Then: 사용자 정의 클래스가 적용됨
      const textarea = container.querySelector('textarea')
      expect(textarea?.className).toBe('custom-html-source')
    })

    it('minHeight를 적용해야 함', () => {
      // Given: minHeight가 지정된 config
      const config: EditingAreaConfig = {
        container,
        minHeight: 300,
      }

      // When: HtmlSourceArea 생성
      htmlSourceArea = new HtmlSourceArea(config)

      // Then: minHeight 스타일이 적용됨
      const textarea = container.querySelector('textarea')
      expect(textarea?.style.minHeight).toBe('300px')
    })

    it('기본적으로 숨겨져 있어야 함', () => {
      // Given: 기본 config
      const config: EditingAreaConfig = { container }

      // When: HtmlSourceArea 생성
      htmlSourceArea = new HtmlSourceArea(config)

      // Then: 숨김 상태로 생성됨
      expect(htmlSourceArea.isVisible()).toBe(false)
      const textarea = container.querySelector('textarea')
      expect(textarea?.style.display).toBe('none')
    })

    it('monospace 폰트를 사용해야 함', () => {
      // Given: 기본 config
      const config: EditingAreaConfig = { container }

      // When: HtmlSourceArea 생성
      htmlSourceArea = new HtmlSourceArea(config)

      // Then: monospace 폰트 패밀리가 적용됨
      const textarea = container.querySelector('textarea')
      expect(textarea?.style.fontFamily).toContain('monospace')
    })
  })

  describe('콘텐츠 관리 (HTML 저장 및 포맷팅)', () => {
    /**
     * Why: HTML 소스 코드를 직접 편집하고 가독성 있게 표시해야 함
     * How: `setContent()`/`getContent()`로 HTML 저장/조회, `HTMLConverter`로 포맷팅
     */

    beforeEach(() => {
      const config: EditingAreaConfig = { container }
      htmlSourceArea = new HtmlSourceArea(config)
    })

    it('원시 콘텐츠를 설정하고 가져올 수 있어야 함', () => {
      // Given: HTML 문자열
      const html = '<p>Hello World</p>'

      // When: setRawContent로 설정
      htmlSourceArea.setRawContent(html)

      // Then: getRawContent로 동일한 값 조회
      expect(htmlSourceArea.getRawContent()).toBe(html)
    })

    it('콘텐츠를 HTML로 가져올 수 있어야 함', async () => {
      // Given: HTML 문자열이 설정된 상태
      const html = '<p>Hello World</p>'
      htmlSourceArea.setRawContent(html)

      // When: getContent 호출
      const content = await htmlSourceArea.getContent()

      // Then: 설정한 HTML이 반환됨
      expect(content).toBe(html)
    })

    it('HTML로부터 콘텐츠를 설정할 수 있어야 함', async () => {
      // Given: HTML 문자열
      const html = '<p>Hello World</p>'

      // When: setContent로 설정
      await htmlSourceArea.setContent(html)

      // Then: 포맷팅될 수 있지만 구조는 보존됨
      const rawContent = htmlSourceArea.getRawContent()
      expect(rawContent).toContain('Hello World')
      expect(rawContent).toContain('<p>')
      expect(rawContent).toContain('</p>')
    })

    it('콘텐츠 설정 시 HTML을 포맷해야 함', async () => {
      // Given: 한 줄로 된 중첩 HTML
      const html = '<div><p>Hello</p></div>'

      // When: setContent로 설정
      await htmlSourceArea.setContent(html)

      // Then: 줄 바꿈과 들여쓰기가 추가됨
      const rawContent = htmlSourceArea.getRawContent()
      expect(rawContent).toContain('\n')
    })

    it('빈 콘텐츠를 처리해야 함', async () => {
      // Given: 빈 문자열

      // When: setContent로 빈 콘텐츠 설정
      await htmlSourceArea.setContent('')

      // Then: 빈 문자열이 저장됨
      expect(htmlSourceArea.getRawContent()).toBe('')
    })

    it('빈 HTML 마커를 정리해야 함', async () => {
      // Given: 다양한 빈 HTML 패턴

      // When & Then: 각 패턴이 빈 문자열로 정리됨
      await htmlSourceArea.setContent('<br>')
      expect(htmlSourceArea.getRawContent()).toBe('')

      await htmlSourceArea.setContent('<p>&nbsp;</p>')
      expect(htmlSourceArea.getRawContent()).toBe('')

      await htmlSourceArea.setContent('<p><br></p>')
      expect(htmlSourceArea.getRawContent()).toBe('')

      await htmlSourceArea.setContent('<p></p>')
      expect(htmlSourceArea.getRawContent()).toBe('')
    })

    it('HTML 구조를 보존해야 함', async () => {
      // Given: 복잡한 중첩 HTML
      const html = '<div><p><strong>Bold</strong> text</p></div>'

      // When: setContent로 설정
      await htmlSourceArea.setContent(html)

      // Then: HTML 구조가 보존됨
      const content = await htmlSourceArea.getContent()
      expect(content).toContain('div')
      expect(content).toContain('strong')
      expect(content).toContain('Bold')
    })
  })

  describe('표시 관리 (show/hide)', () => {
    /**
     * Why: 모드 전환 시 HTML 소스 영역을 표시하거나 숨겨야 함
     * How: `show()`/`hide()`로 display 스타일 제어
     */

    beforeEach(() => {
      const config: EditingAreaConfig = { container }
      htmlSourceArea = new HtmlSourceArea(config)
    })

    it('HTML 소스 영역을 표시해야 함', async () => {
      // Given: 숨겨진 상태의 HtmlSourceArea

      // When: show 호출
      await htmlSourceArea.show()

      // Then: 표시 상태로 변경됨
      expect(htmlSourceArea.isVisible()).toBe(true)
      const textarea = container.querySelector('textarea')
      expect(textarea?.style.display).toBe('block')
    })

    it('HTML 소스 영역을 숨겨야 함', async () => {
      // Given: 표시된 상태의 HtmlSourceArea
      await htmlSourceArea.show()

      // When: hide 호출
      await htmlSourceArea.hide()

      // Then: 숨김 상태로 변경됨
      expect(htmlSourceArea.isVisible()).toBe(false)
      const textarea = container.querySelector('textarea')
      expect(textarea?.style.display).toBe('none')
    })
  })

  describe('포커스 관리 (textarea focus)', () => {
    /**
     * Why: HTML 소스 편집 시 사용자가 바로 타이핑을 시작할 수 있어야 함
     * How: `focus()`로 textarea에 포커스, 커서 위치 설정
     */

    beforeEach(() => {
      const config: EditingAreaConfig = { container }
      htmlSourceArea = new HtmlSourceArea(config)
    })

    it('textarea에 포커스를 설정해야 함', () => {
      // Given: 표시된 HtmlSourceArea
      htmlSourceArea.show()

      // When: focus 호출
      htmlSourceArea.focus()

      // Then: textarea가 활성 요소임
      const textarea = container.querySelector('textarea')
      expect(document.activeElement).toBe(textarea)
    })

    it('포커스 시 커서를 시작 위치로 설정해야 함', () => {
      // Given: 콘텐츠가 있는 HtmlSourceArea
      htmlSourceArea.setRawContent('<p>Hello World</p>')

      // When: focus 호출
      htmlSourceArea.focus()

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
      htmlSourceArea = new HtmlSourceArea(config)
    })

    it('기본적으로 편집이 활성화되어야 함', () => {
      // Given: 생성된 HtmlSourceArea

      // When: disabled 속성 확인

      // Then: disabled가 false임
      const textarea = container.querySelector(
        'textarea'
      ) as HTMLTextAreaElement
      expect(textarea.disabled).toBe(false)
    })

    it('편집을 비활성화할 수 있어야 함', () => {
      // Given: 생성된 HtmlSourceArea

      // When: setEditable(false) 호출
      htmlSourceArea.setEditable(false)

      // Then: disabled가 true로 변경됨
      const textarea = container.querySelector(
        'textarea'
      ) as HTMLTextAreaElement
      expect(textarea.disabled).toBe(true)
    })

    it('편집을 활성화할 수 있어야 함', () => {
      // Given: 편집이 비활성화된 HtmlSourceArea
      htmlSourceArea.setEditable(false)

      // When: setEditable(true) 호출
      htmlSourceArea.setEditable(true)

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
      htmlSourceArea = new HtmlSourceArea(config)
    })

    it('textarea 요소를 반환해야 함', () => {
      // Given: 생성된 HtmlSourceArea

      // When: getElement 호출
      const element = htmlSourceArea.getElement()

      // Then: HTMLTextAreaElement 인스턴스가 반환됨
      expect(element).toBeInstanceOf(HTMLTextAreaElement)
      expect(element.tagName).toBe('TEXTAREA')
    })
  })

  describe('콘텐츠 조작 (포맷/압축/정리)', () => {
    /**
     * Why: HTML 소스를 가독성 있게 포맷하거나 압축하거나 정리해야 함
     * How: `HTMLConverter`로 `formatHTML()`/압축/`cleanHTML()` 실행
     */

    beforeEach(() => {
      const config: EditingAreaConfig = { container }
      htmlSourceArea = new HtmlSourceArea(config)
    })

    it('콘텐츠를 포맷해야 함', () => {
      // Given: 한 줄로 된 HTML
      const minified = '<div><p>Hello</p></div>'
      htmlSourceArea.setRawContent(minified)

      // When: formatContent 호출
      htmlSourceArea.formatContent()

      // Then: 줄 바꿈이 추가됨
      const formatted = htmlSourceArea.getRawContent()
      expect(formatted).toContain('\n')
    })

    it('콘텐츠를 압축해야 함', () => {
      // Given: 포맷된 HTML (줄 바꿈과 들여쓰기 포함)
      const formatted = '<div>\n  <p>Hello</p>\n</div>'
      htmlSourceArea.setRawContent(formatted)

      // When: minifyContent 호출
      htmlSourceArea.minifyContent()

      // Then: 불필요한 공백이 제거됨
      const minified = htmlSourceArea.getRawContent()
      expect(minified).not.toContain('\n')
      expect(minified.length).toBeLessThan(formatted.length)
    })

    it('콘텐츠를 정리해야 함', () => {
      // Given: script 태그가 포함된 위험한 HTML
      const dirty = '<p>Text</p><script>alert("xss")</script>'
      htmlSourceArea.setRawContent(dirty)

      // When: cleanContent 호출
      htmlSourceArea.cleanContent()

      // Then: script 태그가 제거되고 텍스트는 보존됨
      const cleaned = htmlSourceArea.getRawContent()
      expect(cleaned).not.toContain('script')
      expect(cleaned).toContain('Text')
    })
  })

  describe('탭 키 지원 (들여쓰기)', () => {
    /**
     * Why: HTML 소스 편집 시 Tab 키로 들여쓰기가 가능해야 함
     * How: keydown 이벤트 리스너로 Tab 키 감지, 공백 삽입
     */

    beforeEach(() => {
      const config: EditingAreaConfig = { container }
      htmlSourceArea = new HtmlSourceArea(config)
    })

    it('Tab 키 입력 시 공백을 삽입해야 함', () => {
      // Given: 콘텐츠가 있고 커서가 특정 위치에 있는 상태
      htmlSourceArea.setRawContent('<div>')
      const textarea = container.querySelector(
        'textarea'
      ) as HTMLTextAreaElement
      textarea.setSelectionRange(5, 5)

      // When: Tab 키 이벤트 발생
      const event = new KeyboardEvent('keydown', {
        key: 'Tab',
        bubbles: true,
        cancelable: true,
      })
      textarea.dispatchEvent(event)

      // Then: 공백이 삽입됨
      const content = htmlSourceArea.getRawContent()
      expect(content).toContain('  ')
    })
  })

  describe('리소스 정리 (destroy)', () => {
    /**
     * Why: 메모리 누수를 방지하기 위해 리소스를 정리해야 함
     * How: `destroy()`로 DOM에서 textarea 제거
     */

    it('destroy 시 textarea를 제거해야 함', () => {
      // Given: 생성된 HtmlSourceArea
      const config: EditingAreaConfig = { container }
      htmlSourceArea = new HtmlSourceArea(config)

      const textarea = container.querySelector('textarea')
      expect(textarea).toBeDefined()

      // When: destroy 호출
      htmlSourceArea.destroy()

      // Then: textarea가 DOM에서 제거됨
      const afterDestroy = container.querySelector('textarea')
      expect(afterDestroy).toBeNull()
    })
  })

  describe('왕복 변환 (set/get 보존)', () => {
    /**
     * Why: setContent/getContent 왕복 시 HTML 구조가 손실되면 안 됨
     * How: `setContent()` → `getContent()` 왕복 후 HTML 구조 보존 확인
     */

    beforeEach(() => {
      const config: EditingAreaConfig = { container }
      htmlSourceArea = new HtmlSourceArea(config)
    })

    it('set/get을 통해 HTML을 보존해야 함', async () => {
      // Given: 서식 태그가 포함된 HTML
      const originalHTML = '<p>Hello <strong>World</strong></p>'

      // When: setContent → getContent 왕복
      await htmlSourceArea.setContent(originalHTML)
      const content = await htmlSourceArea.getContent()

      // Then: HTML 구조가 보존됨 (포맷팅은 달라질 수 있음)
      expect(content).toContain('Hello')
      expect(content).toContain('strong')
      expect(content).toContain('World')
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

      // When: HtmlSourceArea 생성
      // Then: 오류 없이 생성됨
      expect(() => {
        htmlSourceArea = new HtmlSourceArea(config)
      }).not.toThrow()
    })
  })
})
