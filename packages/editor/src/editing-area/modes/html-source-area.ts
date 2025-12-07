import type { EditingArea, EditingAreaConfig, IRContent } from '../types'
import { HTMLConverter } from '../converters/html-converter'

export class HtmlSourceArea implements EditingArea {
  private textarea: HTMLTextAreaElement
  private converter: HTMLConverter
  private container: HTMLElement
  private visible: boolean = false

  constructor(config: EditingAreaConfig) {
    this.container = config.container
    this.converter = new HTMLConverter()

    this.textarea = document.createElement('textarea')
    this.textarea.className = config.className || 'modern-html-source-area'

    if (config.minHeight) {
      this.textarea.style.minHeight = `${config.minHeight}px`
    }

    this.textarea.style.width = '100%'
    this.textarea.style.height = '100%'
    this.textarea.style.resize = 'none'
    this.textarea.style.border = 'none'
    this.textarea.style.outline = 'none'
    this.textarea.style.padding = '10px'
    this.textarea.style.fontFamily = '"Courier New", Courier, monospace'
    this.textarea.style.fontSize = '13px'
    this.textarea.style.lineHeight = '1.5'
    this.textarea.style.tabSize = '2'
    this.textarea.style.whiteSpace = 'pre'
    this.textarea.style.overflowWrap = 'normal'
    this.textarea.style.display = 'none'

    this.textarea.spellcheck = false

    this.container.appendChild(this.textarea)

    if (config.autoResize) {
      this.setupAutoResize()
    }

    this.setupTabSupport()
  }

  /**
   * IR 형식(HTML)으로 콘텐츠를 가져옵니다
   * 원시 HTML 소스를 반환합니다
   */
  async getContent(): Promise<IRContent> {
    return this.textarea.value
  }

  /**
   * IR 형식(HTML)에서 콘텐츠를 설정합니다
   * HTML 소스를 포맷하여 표시합니다
   */
  async setContent(content: IRContent): Promise<void> {
    if (
      !content ||
      content === '<br>' ||
      content === '<p>&nbsp;</p>' ||
      content === '<p><br></p>' ||
      content === '<p></p>'
    ) {
      this.textarea.value = ''
      return
    }

    const formatted = this.converter.formatHTML(content)
    this.textarea.value = formatted
  }

  /**
   * HTML 소스 편집 영역을 표시합니다
   */
  async show(): Promise<void> {
    this.textarea.style.display = 'block'
    this.visible = true
  }

  /**
   * HTML 소스 편집 영역을 숨깁니다
   */
  async hide(): Promise<void> {
    this.textarea.style.display = 'none'
    this.visible = false
  }

  /**
   * `textarea`에 포커스를 설정합니다
   */
  focus(): void {
    this.textarea.focus()
    this.textarea.setSelectionRange(0, 0)
  }

  /**
   * 편집 가능 여부를 설정합니다
   */
  setEditable(enabled: boolean): void {
    this.textarea.disabled = !enabled
  }

  /**
   * 원시 `textarea` 값을 가져옵니다 (HTML 소스)
   */
  getRawContent(): string {
    return this.textarea.value
  }

  /**
   * 원시 `textarea` 값을 설정합니다 (HTML 소스)
   */
  setRawContent(content: string): void {
    this.textarea.value = content
  }

  /**
   * 현재 표시 여부를 확인합니다
   */
  isVisible(): boolean {
    return this.visible
  }

  /**
   * `textarea` 요소를 가져옵니다
   */
  getElement(): HTMLElement {
    return this.textarea
  }

  /**
   * 자동 크기 조정 기능을 설정합니다
   */
  private setupAutoResize(): void {
    const adjustHeight = () => {
      this.textarea.style.height = 'auto'

      const newHeight = this.textarea.scrollHeight
      this.textarea.style.height = `${newHeight}px`
    }

    this.textarea.addEventListener('input', adjustHeight)
    adjustHeight()
  }

  /**
   * 들여쓰기를 위한 탭 키 지원을 설정합니다
   * 다음 요소로 포커스를 이동하는 대신 공백을 삽입할 수 있도록 합니다
   */
  private setupTabSupport(): void {
    this.textarea.addEventListener('keydown', (event) => {
      if (event.key === 'Tab') {
        event.preventDefault()

        const start = this.textarea.selectionStart
        const end = this.textarea.selectionEnd
        const value = this.textarea.value

        this.textarea.value =
          value.substring(0, start) + '  ' + value.substring(end)

        this.textarea.selectionStart = this.textarea.selectionEnd = start + 2
      }
    })
  }

  /**
   * 현재 HTML 콘텐츠를 포맷합니다
   * HTML에 프리티 프린팅을 적용합니다
   */
  formatContent(): void {
    const content = this.textarea.value

    if (!content) {
      return
    }

    const formatted = this.converter.formatHTML(content)

    this.textarea.value = formatted
  }

  /**
   * 현재 HTML 콘텐츠를 압축합니다
   * 불필요한 공백을 제거합니다
   */
  minifyContent(): void {
    const content = this.textarea.value

    if (!content) {
      return
    }

    const minified = content.replace(/\s+/g, ' ').trim()
    this.textarea.value = minified
  }

  /**
   * 현재 HTML 콘텐츠를 정리합니다
   * 스크립트, 스타일, 주석을 제거합니다
   */
  cleanContent(): void {
    const content = this.textarea.value

    if (!content) {
      return
    }

    const cleaned = this.converter.cleanHTML(content)

    this.textarea.value = cleaned
  }

  /**
   * 리소스를 정리합니다
   */
  destroy(): void {
    if (this.textarea.parentNode) {
      this.textarea.parentNode.removeChild(this.textarea)
    }
  }
}
