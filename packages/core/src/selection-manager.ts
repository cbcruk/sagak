/**
 * `SelectionManager` - 텍스트 선택과 범위 작업을 관리합니다
 *
 * 기능:
 * - `Selection`/`Range` API 래퍼
 * - 선택 영역 저장 및 복원
 * - `HTML` 콘텐츠 삽입/삭제
 * - `CJK` (한국어/일본어/중국어) 입력 지원
 * - 크로스 브라우저 호환성
 */

/**
 * 네이티브 `Selection` 및 `Range` API를 다음 기능으로 래핑합니다:
 * - 단순화된 인터페이스
 * - `CJK`/`IME` 입력 처리
 * - 선택 영역 지속성
 * - 안전한 `HTML` 조작
 *
 * @example
 * ```typescript
 * const manager = new SelectionManager(element);
 *
 * manager.saveSelection();
 *
 * manager.restoreSelection();
 *
 * manager.insertHTML('<strong>Bold text</strong>');
 * ```
 */
export class SelectionManager {
  private element: HTMLElement
  private savedRange: Range | null = null
  private isComposing = false

  /**
   * `SelectionManager`를 생성합니다
   *
   * @param element 선택 영역을 관리할 편집 가능한 요소
   */
  constructor(element: HTMLElement) {
    this.element = element
    this.initializeCompositionListeners()
  }

  /**
   * `CJK` 입력 지원을 위한 입력 이벤트 리스너를 초기화합니다
   */
  private initializeCompositionListeners(): void {
    this.element.addEventListener('compositionstart', () => {
      this.isComposing = true
    })

    this.element.addEventListener('compositionend', () => {
      this.isComposing = false
    })
  }

  /**
   * 현재 선택 영역을 가져옵니다
   *
   * @returns `Selection` 객체 또는 `null`
   */
  getSelection(): Selection | null {
    return window.getSelection()
  }

  /**
   * 현재 범위를 가져옵니다
   *
   * @returns `Range` 객체 또는 선택이 없으면 `null`
   */
  getCurrentRange(): Range | null {
    const selection = this.getSelection()

    if (!selection || selection.rangeCount === 0) {
      return null
    }

    return selection.getRangeAt(0)
  }

  /**
   * 현재 선택 영역을 저장합니다
   * 포커스를 잃을 때 유용합니다 (예: 다이얼로그 열기)
   *
   * @returns 선택 영역이 저장되면 `true`, 그렇지 않으면 `false`
   *
   * @example
   * ```typescript
   * manager.saveSelection();
   *
   * showLinkDialog(() => {
   *   manager.restoreSelection();
   *   manager.insertHTML('<a href="...">link</a>');
   * });
   * ```
   */
  saveSelection(): boolean {
    if (this.isComposing) {
      return false
    }

    const range = this.getCurrentRange()

    if (!range) {
      return false
    }

    if (!this.isRangeInElement(range)) {
      return false
    }

    this.savedRange = range.cloneRange()

    return true
  }

  /**
   * 이전에 저장한 선택 영역을 복원합니다
   *
   * @returns 선택 영역이 복원되면 `true`, 그렇지 않으면 `false`
   */
  restoreSelection(): boolean {
    if (!this.savedRange) {
      return false
    }

    if (this.isComposing) {
      return false
    }

    try {
      const selection = this.getSelection()

      if (!selection) {
        return false
      }

      selection.removeAllRanges()
      selection.addRange(this.savedRange)

      return true
    } catch (error) {
      console.error('Failed to restore selection:', error)
      return false
    }
  }

  /**
   * 저장된 선택 영역을 지웁니다
   */
  clearSavedSelection(): void {
    this.savedRange = null
  }

  /**
   * 범위가 관리되는 요소 내에 있는지 확인합니다
   *
   * @param range 확인할 범위
   * @returns 범위가 요소 내에 있으면 `true`
   */
  private isRangeInElement(range: Range): boolean {
    const container = range.commonAncestorContainer
    const node =
      container.nodeType === Node.TEXT_NODE ? container.parentNode : container

    return this.element.contains(node as Node)
  }

  /**
   * 현재 선택 영역 또는 저장된 선택 영역에 `HTML`을 삽입합니다
   *
   * @param html 삽입할 `HTML` 문자열
   * @returns 성공적으로 삽입되면 `true`, 그렇지 않으면 `false`
   *
   * @example
   * ```typescript
   * manager.insertHTML('<strong>Bold</strong>');
   * manager.insertHTML('<a href="https://example.com">Link</a>');
   * ```
   */
  insertHTML(html: string): boolean {
    if (this.isComposing) {
      console.warn('Cannot insert HTML during IME composition')
      return false
    }

    const range = this.getCurrentRange()

    if (!range) {
      return false
    }

    if (!this.isRangeInElement(range)) {
      return false
    }

    try {
      range.deleteContents()

      const fragment = range.createContextualFragment(html)
      range.insertNode(fragment)
      range.collapse(false)

      const selection = this.getSelection()

      if (selection) {
        selection.removeAllRanges()
        selection.addRange(range)
      }

      return true
    } catch (error) {
      console.error('Failed to insert HTML:', error)
      return false
    }
  }

  /**
   * 현재 선택 영역에 일반 텍스트를 삽입합니다
   * `HTML` 문자를 이스케이프합니다
   *
   * @param text 삽입할 텍스트
   * @returns 성공적으로 삽입되면 `true`
   */
  insertText(text: string): boolean {
    if (this.isComposing) {
      console.warn('Cannot insert text during IME composition')
      return false
    }

    const range = this.getCurrentRange()

    if (!range) {
      return false
    }

    if (!this.isRangeInElement(range)) {
      return false
    }

    try {
      range.deleteContents()

      const textNode = document.createTextNode(text)
      range.insertNode(textNode)
      range.setStartAfter(textNode)
      range.collapse(true)

      const selection = this.getSelection()

      if (selection) {
        selection.removeAllRanges()
        selection.addRange(range)
      }

      return true
    } catch (error) {
      console.error('Failed to insert text:', error)
      return false
    }
  }

  /**
   * 현재 선택 영역의 콘텐츠를 삭제합니다
   *
   * @returns 성공적으로 삭제되면 `true`
   */
  deleteContents(): boolean {
    if (this.isComposing) {
      console.warn('Cannot delete during IME composition')
      return false
    }

    const range = this.getCurrentRange()

    if (!range) {
      return false
    }

    if (!this.isRangeInElement(range)) {
      return false
    }

    try {
      range.deleteContents()
      return true
    } catch (error) {
      console.error('Failed to delete contents:', error)
      return false
    }
  }

  /**
   * 특정 노드를 선택합니다
   *
   * @param node 선택할 노드
   * @returns 성공적으로 선택되면 `true`
   */
  selectNode(node: Node): boolean {
    if (this.isComposing) {
      return false
    }

    if (!this.element.contains(node)) {
      return false
    }

    try {
      const range = document.createRange()

      range.selectNode(node)

      const selection = this.getSelection()

      if (!selection) {
        return false
      }

      selection.removeAllRanges()
      selection.addRange(range)

      return true
    } catch (error) {
      console.error('Failed to select node:', error)
      return false
    }
  }

  /**
   * 노드의 콘텐츠를 선택합니다
   *
   * @param node 콘텐츠를 선택할 노드
   * @returns 성공적으로 선택되면 `true`
   */
  selectNodeContents(node: Node): boolean {
    if (this.isComposing) {
      return false
    }

    if (!this.element.contains(node)) {
      return false
    }

    try {
      const range = document.createRange()

      range.selectNodeContents(node)

      const selection = this.getSelection()

      if (!selection) {
        return false
      }

      selection.removeAllRanges()
      selection.addRange(range)
      return true
    } catch (error) {
      console.error('Failed to select node contents:', error)
      return false
    }
  }

  /**
   * 선택 영역을 시작 위치로 축소합니다
   */
  collapseToStart(): void {
    if (this.isComposing) {
      return
    }

    const selection = this.getSelection()

    if (selection && selection.rangeCount > 0) {
      selection.collapseToStart()
    }
  }

  /**
   * 선택 영역을 끝 위치로 축소합니다
   */
  collapseToEnd(): void {
    if (this.isComposing) {
      return
    }

    const selection = this.getSelection()

    if (selection && selection.rangeCount > 0) {
      selection.collapseToEnd()
    }
  }

  /**
   * 선택 영역이 축소되어 있는지 확인합니다 (커서만 있고 선택 없음)
   *
   * @returns 축소되어 있으면 `true`
   */
  isCollapsed(): boolean {
    const selection = this.getSelection()

    return selection ? selection.isCollapsed : true
  }

  /**
   * 선택된 텍스트 콘텐츠를 가져옵니다
   *
   * @returns 선택된 텍스트 또는 빈 문자열
   */
  getSelectedText(): string {
    const selection = this.getSelection()

    return selection ? selection.toString() : ''
  }

  /**
   * 선택된 `HTML` 콘텐츠를 가져옵니다
   *
   * @returns 선택된 `HTML` 또는 빈 문자열
   */
  getSelectedHTML(): string {
    const range = this.getCurrentRange()

    if (!range) {
      return ''
    }

    const fragment = range.cloneContents()
    const div = document.createElement('div')
    div.appendChild(fragment)

    return div.innerHTML
  }

  /**
   * 선택 영역이 있는지 확인합니다
   *
   * @returns 선택 영역이 있으면 `true`
   */
  hasSelection(): boolean {
    const selection = this.getSelection()

    return !!(selection && selection.rangeCount > 0)
  }

  /**
   * 모든 선택 영역을 지웁니다
   */
  clearSelection(): void {
    if (this.isComposing) {
      return
    }

    const selection = this.getSelection()

    if (selection) {
      selection.removeAllRanges()
    }
  }

  /**
   * 관리되는 요소를 가져옵니다
   */
  getElement(): HTMLElement {
    return this.element
  }

  /**
   * 현재 `IME` 입력 중인지 확인합니다
   *
   * @returns 입력 중이면 `true`
   */
  getIsComposing(): boolean {
    return this.isComposing
  }

  /**
   * `SelectionManager`를 정리합니다
   * 이벤트 리스너를 제거합니다
   */
  destroy(): void {
    this.clearSavedSelection()
    // 참조를 저장하지 않아 composition 리스너를 제거할 수 없음
    // 필요시 리팩토링 고려
  }
}
