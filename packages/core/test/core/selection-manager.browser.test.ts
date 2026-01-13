import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { SelectionManager } from '@/core/selection-manager'

/**
 * SelectionManager 테스트
 *
 * Why: `WYSIWYG` 에디터의 선택 영역 관리 및 `CJK/IME` 입력 지원
 * How: `Selection API` 래핑, 선택 영역 저장/복원, `HTML/텍스트` 삽입, `IME` 상태 추적
 */
describe('SelectionManager', () => {
  let element: HTMLDivElement
  let manager: SelectionManager

  beforeEach(() => {
    element = document.createElement('div')
    element.contentEditable = 'true'
    element.innerHTML = '<p>Hello World</p>'
    document.body.appendChild(element)

    manager = new SelectionManager(element)
  })

  afterEach(() => {
    document.body.removeChild(element)
  })

  /**
   * Why: 브라우저 `Selection API`를 편리하게 사용하기 위한 기본 인터페이스 제공
   * How: `getSelection()`, `getCurrentRange()`로 선택 영역 조회
   */
  describe('기본 기능 (선택 영역 관리)', () => {
    it('인스턴스를 생성할 수 있어야 함', () => {
      // Given: SelectionManager 클래스
      // When: 인스턴스 생성
      // Then: SelectionManager 인스턴스여야 함
      expect(manager).toBeInstanceOf(SelectionManager)
    })

    it('관리되는 요소를 가져올 수 있어야 함', () => {
      // Given: SelectionManager 인스턴스
      // When: 관리 요소 조회
      // Then: 설정한 요소를 반환해야 함
      expect(manager.getElement()).toBe(element)
    })

    it('선택 영역을 가져올 수 있어야 함', () => {
      // Given: SelectionManager 인스턴스
      // When: 선택 영역 조회
      // Then: Selection 객체를 반환해야 함
      const selection = manager.getSelection()
      expect(selection).toBeTruthy()
    })

    it('현재 범위를 가져올 수 있어야 함', () => {
      // Given: "Hello"를 선택한 상태
      const textNode = element.firstChild!.firstChild as Text
      const range = document.createRange()
      range.setStart(textNode, 0)
      range.setEnd(textNode, 5)

      const selection = window.getSelection()!
      selection.removeAllRanges()
      selection.addRange(range)

      // When: 현재 범위 조회
      const currentRange = manager.getCurrentRange()

      // Then: 선택한 범위를 반환해야 함
      expect(currentRange).toBeTruthy()
      expect(currentRange!.toString()).toBe('Hello')
    })

    it('선택 영역이 없을 때 getCurrentRange가 null을 반환해야 함', () => {
      // Given: 선택 영역이 없는 상태
      const selection = window.getSelection()!
      selection.removeAllRanges()

      // When: 현재 범위 조회
      // Then: null을 반환해야 함
      expect(manager.getCurrentRange()).toBeNull()
    })
  })

  /**
   * Why: 툴바 버튼 클릭 등으로 포커스가 이동할 때 선택 영역을 유지하기 위함
   * How: `saveSelection()`으로 저장, `restoreSelection()`으로 복원
   */
  describe('선택 영역 저장 및 복원 (포커스 손실 대응)', () => {
    it('선택 영역을 저장할 수 있어야 함', () => {
      // Given: "Hello"를 선택한 상태
      const textNode = element.firstChild!.firstChild as Text
      const range = document.createRange()
      range.setStart(textNode, 0)
      range.setEnd(textNode, 5)

      const selection = window.getSelection()!
      selection.removeAllRanges()
      selection.addRange(range)

      // When: 선택 영역 저장
      const result = manager.saveSelection()

      // Then: 저장에 성공해야 함
      expect(result).toBe(true)
    })

    it('저장된 선택 영역을 복원할 수 있어야 함', () => {
      // Given: "Hello"를 선택하고 저장한 후 선택 영역을 제거한 상태
      const textNode = element.firstChild!.firstChild as Text
      const range = document.createRange()
      range.setStart(textNode, 0)
      range.setEnd(textNode, 5)

      const selection = window.getSelection()!
      selection.removeAllRanges()
      selection.addRange(range)

      manager.saveSelection()
      selection.removeAllRanges()
      expect(selection.rangeCount).toBe(0)

      // When: 선택 영역 복원
      const result = manager.restoreSelection()

      // Then: 복원에 성공하고 원래 선택 영역이 복구되어야 함
      expect(result).toBe(true)
      expect(selection.rangeCount).toBe(1)
      expect(selection.toString()).toBe('Hello')
    })

    it('저장된 선택 영역 없이 복원 시 false를 반환해야 함', () => {
      // Given: 저장된 선택 영역이 없는 상태
      // When: 복원 시도
      const result = manager.restoreSelection()

      // Then: false를 반환해야 함
      expect(result).toBe(false)
    })

    it('저장된 선택 영역을 지울 수 있어야 함', () => {
      // Given: 선택 영역을 저장한 상태
      const textNode = element.firstChild!.firstChild as Text
      const range = document.createRange()
      range.setStart(textNode, 0)
      range.setEnd(textNode, 5)

      const selection = window.getSelection()!
      selection.removeAllRanges()
      selection.addRange(range)

      manager.saveSelection()

      // When: 저장된 선택 영역을 제거
      manager.clearSavedSelection()

      // Then: 복원이 실패해야 함
      const result = manager.restoreSelection()
      expect(result).toBe(false)
    })
  })

  /**
   * Why: 서식이 적용된 콘텐츠를 에디터에 추가하기 위함
   * How: `insertHTML()`로 선택 영역에 `HTML` 삽입, 선택된 텍스트 대체
   */
  describe('HTML 삽입 (콘텐츠 추가)', () => {
    it('현재 위치에 HTML을 삽입할 수 있어야 함', () => {
      // Given: "Hello" 다음에 커서가 위치한 상태
      const textNode = element.firstChild!.firstChild as Text
      const range = document.createRange()
      range.setStart(textNode, 5)
      range.collapse(true)

      const selection = window.getSelection()!
      selection.removeAllRanges()
      selection.addRange(range)

      // When: HTML 삽입
      const result = manager.insertHTML(' <strong>Bold</strong>')

      // Then: HTML이 삽입되어야 함
      expect(result).toBe(true)
      expect(element.innerHTML).toContain('<strong>Bold</strong>')
    })

    it('선택된 텍스트를 HTML로 대체할 수 있어야 함', () => {
      // Given: "Hello"를 선택한 상태
      const textNode = element.firstChild!.firstChild as Text
      const range = document.createRange()
      range.setStart(textNode, 0)
      range.setEnd(textNode, 5)

      const selection = window.getSelection()!
      selection.removeAllRanges()
      selection.addRange(range)

      // When: HTML로 대체
      manager.insertHTML('<strong>Hi</strong>')

      // Then: 선택된 텍스트가 HTML로 대체되어야 함
      expect(element.innerHTML).toContain('<strong>Hi</strong>')
      expect(element.innerHTML).not.toContain('Hello')
    })

    it('선택 영역이 없을 때 false를 반환해야 함', () => {
      // Given: 선택 영역이 없는 상태
      const selection = window.getSelection()!
      selection.removeAllRanges()

      // When: HTML 삽입 시도
      const result = manager.insertHTML('<strong>Test</strong>')

      // Then: false를 반환해야 함
      expect(result).toBe(false)
    })
  })

  /**
   * Why: `XSS` 공격 방지 및 안전한 일반 텍스트 삽입
   * How: `insertText()`로 일반 텍스트 삽입, `HTML` 문자 자동 이스케이프
   */
  describe('텍스트 삽입 (안전한 콘텐츠 추가)', () => {
    it('일반 텍스트를 삽입할 수 있어야 함', () => {
      // Given: "Hello" 다음에 커서가 위치한 상태
      const textNode = element.firstChild!.firstChild as Text
      const range = document.createRange()
      range.setStart(textNode, 5)
      range.collapse(true)

      const selection = window.getSelection()!
      selection.removeAllRanges()
      selection.addRange(range)

      // When: 텍스트 삽입
      const result = manager.insertText(' there')

      // Then: 텍스트가 삽입되어야 함
      expect(result).toBe(true)
      expect(element.textContent).toContain('Hello there')
    })

    it('삽입된 텍스트의 HTML을 이스케이프해야 함', () => {
      // Given: "Hello" 다음에 커서가 위치한 상태
      const textNode = element.firstChild!.firstChild as Text
      const range = document.createRange()
      range.setStart(textNode, 5)
      range.collapse(true)

      const selection = window.getSelection()!
      selection.removeAllRanges()
      selection.addRange(range)

      // When: HTML을 포함한 텍스트 삽입
      manager.insertText('<script>alert("XSS")</script>')

      // Then: HTML이 이스케이프되어 텍스트로 삽입되어야 함
      expect(element.textContent).toContain('<script>')
      expect(element.innerHTML).not.toContain('<script>alert')
    })
  })

  /**
   * Why: 사용자가 선택한 콘텐츠를 제거하기 위함
   * How: `deleteContents()`로 선택된 콘텐츠 삭제
   */
  describe('콘텐츠 삭제 (선택 영역 제거)', () => {
    it('선택된 콘텐츠를 삭제할 수 있어야 함', () => {
      // Given: "Hello"를 선택한 상태
      const textNode = element.firstChild!.firstChild as Text
      const range = document.createRange()
      range.setStart(textNode, 0)
      range.setEnd(textNode, 5)

      const selection = window.getSelection()!
      selection.removeAllRanges()
      selection.addRange(range)

      // When: 콘텐츠 삭제
      const result = manager.deleteContents()

      // Then: 선택된 콘텐츠가 삭제되어야 함
      expect(result).toBe(true)
      expect(element.textContent).not.toContain('Hello')
      expect(element.textContent).toContain('World')
    })
  })

  /**
   * Why: 선택 영역의 다양한 상태를 확인하여 적절한 동작 수행
   * How: `isCollapsed()`, `getSelectedText()`, `getSelectedHTML()`, `hasSelection()` 등
   */
  describe('선택 영역 유틸리티 (상태 확인)', () => {
    it('축소 상태를 확인할 수 있어야 함', () => {
      // Given: 커서만 있는 상태 (축소됨)
      const textNode = element.firstChild!.firstChild as Text
      const range = document.createRange()
      range.setStart(textNode, 0)
      range.collapse(true)

      const selection = window.getSelection()!
      selection.removeAllRanges()
      selection.addRange(range)

      // When: 축소 상태 확인
      // Then: 축소되었으므로 true여야 함
      expect(manager.isCollapsed()).toBe(true)

      // Given: 텍스트를 선택한 상태 (축소되지 않음)
      range.setEnd(textNode, 5)
      selection.removeAllRanges()
      selection.addRange(range)

      // When: 축소 상태 확인
      // Then: 축소되지 않았으므로 false여야 함
      expect(manager.isCollapsed()).toBe(false)
    })

    it('선택된 텍스트를 가져올 수 있어야 함', () => {
      // Given: "Hello"를 선택한 상태
      const textNode = element.firstChild!.firstChild as Text
      const range = document.createRange()
      range.setStart(textNode, 0)
      range.setEnd(textNode, 5)

      const selection = window.getSelection()!
      selection.removeAllRanges()
      selection.addRange(range)

      // When: 선택된 텍스트 조회
      // Then: "Hello"를 반환해야 함
      expect(manager.getSelectedText()).toBe('Hello')
    })

    it('선택된 HTML을 가져올 수 있어야 함', () => {
      // Given: <strong>World</strong>의 콘텐츠를 선택한 상태
      element.innerHTML = '<p>Hello <strong>World</strong></p>'

      const strongNode = element.querySelector('strong')!
      const range = document.createRange()
      range.selectNodeContents(strongNode)

      const selection = window.getSelection()!
      selection.removeAllRanges()
      selection.addRange(range)

      // When: 선택된 HTML 조회
      const html = manager.getSelectedHTML()

      // Then: "World"를 반환해야 함
      expect(html).toBe('World')
    })

    it('선택 영역 존재 여부를 확인할 수 있어야 함', () => {
      // Given: 선택 영역이 없는 상태
      const selection = window.getSelection()!
      selection.removeAllRanges()

      // When: 선택 영역 존재 확인
      // Then: false를 반환해야 함
      expect(manager.hasSelection()).toBe(false)

      // Given: "Hello"를 선택한 상태
      const textNode = element.firstChild!.firstChild as Text
      const range = document.createRange()
      range.setStart(textNode, 0)
      range.setEnd(textNode, 5)
      selection.addRange(range)

      // When: 선택 영역 존재 확인
      // Then: true를 반환해야 함
      expect(manager.hasSelection()).toBe(true)
    })

    it('선택 영역을 지울 수 있어야 함', () => {
      // Given: "Hello"를 선택한 상태
      const textNode = element.firstChild!.firstChild as Text
      const range = document.createRange()
      range.setStart(textNode, 0)
      range.setEnd(textNode, 5)

      const selection = window.getSelection()!
      selection.removeAllRanges()
      selection.addRange(range)

      expect(selection.rangeCount).toBe(1)

      // When: 선택 영역 제거
      manager.clearSelection()

      // Then: 선택 영역이 제거되어야 함
      expect(selection.rangeCount).toBe(0)
    })
  })

  /**
   * Why: 특정 `DOM` 노드 전체를 빠르게 선택하기 위함
   * How: `selectNode()`, `selectNodeContents()`로 노드 또는 콘텐츠 선택
   */
  describe('노드 선택 (특정 노드 선택)', () => {
    it('노드를 선택할 수 있어야 함', () => {
      // Given: <p> 요소
      const p = element.firstChild as HTMLParagraphElement

      // When: 노드 선택
      const result = manager.selectNode(p)

      // Then: 노드가 선택되어야 함
      expect(result).toBe(true)

      const selection = window.getSelection()!
      expect(selection.toString()).toBe('Hello World')
    })

    it('노드 콘텐츠를 선택할 수 있어야 함', () => {
      // Given: <p> 요소
      const p = element.firstChild as HTMLParagraphElement

      // When: 노드 콘텐츠 선택
      const result = manager.selectNodeContents(p)

      // Then: 노드 콘텐츠가 선택되어야 함
      expect(result).toBe(true)

      const selection = window.getSelection()!
      expect(selection.toString()).toBe('Hello World')
    })

    it('요소 밖의 노드를 선택하지 않아야 함', () => {
      // Given: 관리 요소 밖의 노드
      const outsideNode = document.createElement('div')
      document.body.appendChild(outsideNode)

      // When: 외부 노드 선택 시도
      const result = manager.selectNode(outsideNode)

      // Then: 선택에 실패해야 함
      expect(result).toBe(false)

      document.body.removeChild(outsideNode)
    })
  })

  /**
   * Why: 선택 영역을 커서로 변환하여 정확한 위치에 입력하기 위함
   * How: `collapseToStart()`, `collapseToEnd()`로 선택 영역을 커서로 축소
   */
  describe('축소 작업 (커서 위치 조정)', () => {
    it('시작 위치로 축소할 수 있어야 함', () => {
      // Given: "Hello"를 선택한 상태
      const textNode = element.firstChild!.firstChild as Text
      const range = document.createRange()
      range.setStart(textNode, 0)
      range.setEnd(textNode, 5)

      const selection = window.getSelection()!
      selection.removeAllRanges()
      selection.addRange(range)

      expect(manager.isCollapsed()).toBe(false)

      // When: 시작 위치로 축소
      manager.collapseToStart()

      // Then: 커서가 시작 위치에 있어야 함
      expect(manager.isCollapsed()).toBe(true)
      const currentRange = manager.getCurrentRange()!
      expect(currentRange.startOffset).toBe(0)
    })

    it('끝 위치로 축소할 수 있어야 함', () => {
      // Given: "Hello"를 선택한 상태
      const textNode = element.firstChild!.firstChild as Text
      const range = document.createRange()
      range.setStart(textNode, 0)
      range.setEnd(textNode, 5)

      const selection = window.getSelection()!
      selection.removeAllRanges()
      selection.addRange(range)

      expect(manager.isCollapsed()).toBe(false)

      // When: 끝 위치로 축소
      manager.collapseToEnd()

      // Then: 커서가 끝 위치에 있어야 함
      expect(manager.isCollapsed()).toBe(true)
      const currentRange = manager.getCurrentRange()!
      expect(currentRange.endOffset).toBe(5)
    })
  })

  /**
   * Why: 한글 등 `CJK` 언어 입력 시 잘못된 선택 영역 조작 방지
   * How: `compositionstart/end` 이벤트로 `IME` 상태 추적, 입력 중 작업 차단
   */
  describe('CJK/IME 입력 지원 (한글 입력 대응)', () => {
    it('입력 상태를 추적해야 함', () => {
      // Given: 초기 상태
      expect(manager.getIsComposing()).toBe(false)

      // When: IME 입력 시작
      element.dispatchEvent(new CompositionEvent('compositionstart'))

      // Then: 입력 중 상태가 되어야 함
      expect(manager.getIsComposing()).toBe(true)

      // When: IME 입력 종료
      element.dispatchEvent(new CompositionEvent('compositionend'))

      // Then: 입력 종료 상태가 되어야 함
      expect(manager.getIsComposing()).toBe(false)
    })

    it('입력 중에는 선택 영역을 저장하지 않아야 함', () => {
      // Given: IME 입력 중인 상태
      element.dispatchEvent(new CompositionEvent('compositionstart'))

      // When: 선택 영역 저장 시도
      const result = manager.saveSelection()

      // Then: 저장에 실패해야 함
      expect(result).toBe(false)
    })

    it('입력 중에는 선택 영역을 복원하지 않아야 함', () => {
      // Given: 선택 영역을 저장한 후 IME 입력 중인 상태
      const textNode = element.firstChild!.firstChild as Text
      const range = document.createRange()
      range.setStart(textNode, 0)
      range.setEnd(textNode, 5)

      const selection = window.getSelection()!
      selection.removeAllRanges()
      selection.addRange(range)

      manager.saveSelection()

      element.dispatchEvent(new CompositionEvent('compositionstart'))

      // When: 선택 영역 복원 시도
      const result = manager.restoreSelection()

      // Then: 복원에 실패해야 함
      expect(result).toBe(false)
    })

    it('입력 중에는 HTML을 삽입하지 않아야 함', () => {
      // Given: IME 입력 중인 상태
      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})

      element.dispatchEvent(new CompositionEvent('compositionstart'))

      // When: HTML 삽입 시도
      const result = manager.insertHTML('<strong>Test</strong>')

      // Then: 삽입에 실패하고 경고를 출력해야 함
      expect(result).toBe(false)
      expect(consoleWarn).toHaveBeenCalledWith(
        'Cannot insert HTML during IME composition'
      )

      consoleWarn.mockRestore()
    })

    it('입력 중에는 텍스트를 삽입하지 않아야 함', () => {
      // Given: IME 입력 중인 상태
      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})

      element.dispatchEvent(new CompositionEvent('compositionstart'))

      // When: 텍스트 삽입 시도
      const result = manager.insertText('Test')

      // Then: 삽입에 실패하고 경고를 출력해야 함
      expect(result).toBe(false)
      expect(consoleWarn).toHaveBeenCalledWith(
        'Cannot insert text during IME composition'
      )

      consoleWarn.mockRestore()
    })

    it('입력 중에는 삭제 작업을 수행하지 않아야 함', () => {
      // Given: IME 입력 중인 상태
      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})

      element.dispatchEvent(new CompositionEvent('compositionstart'))

      // When: 삭제 시도
      const result = manager.deleteContents()

      // Then: 삭제에 실패하고 경고를 출력해야 함
      expect(result).toBe(false)
      expect(consoleWarn).toHaveBeenCalledWith(
        'Cannot delete during IME composition'
      )

      consoleWarn.mockRestore()
    })

    it('입력 종료 후 작업을 허용해야 함', () => {
      // Given: IME 입력 시작 후 종료한 상태
      element.dispatchEvent(new CompositionEvent('compositionstart'))
      expect(manager.getIsComposing()).toBe(true)

      element.dispatchEvent(new CompositionEvent('compositionend'))
      expect(manager.getIsComposing()).toBe(false)

      // When: 커서를 설정하고 텍스트 삽입
      const textNode = element.firstChild!.firstChild as Text
      const range = document.createRange()
      range.setStart(textNode, 5)
      range.collapse(true)

      const selection = window.getSelection()!
      selection.removeAllRanges()
      selection.addRange(range)

      const result = manager.insertText('!')

      // Then: 삽입에 성공해야 함
      expect(result).toBe(true)
    })
  })

  /**
   * Why: 예외 상황에서도 에디터가 중단되지 않도록 안정성 보장
   * How: 에러 발생 시 `console.error` 출력, `false` 반환으로 안전하게 처리
   */
  describe('에러 처리 (안정성 보장)', () => {
    it('에러를 안전하게 처리해야 함', () => {
      // Given: 선택 영역이 없는 상태
      const consoleError = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {})

      const selection = window.getSelection()!
      selection.removeAllRanges()

      // When: 잘못된 상태에서 HTML 삽입 시도
      const result = manager.insertHTML('<strong>Test</strong>')

      // Then: 에러를 처리하고 false를 반환해야 함
      expect(result).toBe(false)

      consoleError.mockRestore()
    })
  })
})
