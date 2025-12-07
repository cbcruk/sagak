import type { EditingArea, EditingAreaConfig, IRContent } from '../types'
import { HTMLConverter } from '../converters/html-converter'

export class TextArea implements EditingArea {
  private textarea: HTMLTextAreaElement
  private converter: HTMLConverter
  private container: HTMLElement
  private visible: boolean = false

  constructor(config: EditingAreaConfig) {
    this.container = config.container
    this.converter = new HTMLConverter()

    this.textarea = document.createElement('textarea')
    this.textarea.className = config.className || 'modern-text-area'

    if (config.minHeight) {
      this.textarea.style.minHeight = `${config.minHeight}px`
    }

    this.textarea.style.width = '100%'
    this.textarea.style.height = '100%'
    this.textarea.style.resize = 'none'
    this.textarea.style.border = 'none'
    this.textarea.style.outline = 'none'
    this.textarea.style.padding = '10px'
    this.textarea.style.fontFamily = 'monospace'
    this.textarea.style.fontSize = '14px'
    this.textarea.style.lineHeight = '1.5'
    this.textarea.style.display = 'none'

    this.container.appendChild(this.textarea)

    if (config.autoResize) {
      this.setupAutoResize()
    }
  }

  /**
   * IR 형식(HTML)으로 콘텐츠를 가져옵니다
   * 순수 텍스트를 HTML로 변환합니다
   */
  async getContent(): Promise<IRContent> {
    const text = this.textarea.value
    const html = this.converter.textToHTML(text)

    return html
  }

  /**
   * IR 형식(HTML)에서 콘텐츠를 설정합니다
   * HTML을 순수 텍스트로 변환합니다
   */
  async setContent(content: IRContent): Promise<void> {
    const text = this.converter.htmlToText(content)

    this.textarea.value = text
  }

  /**
   * 텍스트 편집 영역을 표시합니다
   */
  async show(): Promise<void> {
    this.textarea.style.display = 'block'
    this.visible = true
  }

  /**
   * 텍스트 편집 영역을 숨깁니다
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
   * 원시 `textarea` 값을 가져옵니다 (변환 없음)
   */
  getRawContent(): string {
    return this.textarea.value
  }

  /**
   * 원시 `textarea` 값을 설정합니다 (변환 없음)
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
   * 콘텐츠에 따라 `textarea` 크기가 늘어나거나 줄어듭니다
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
   * 리소스를 정리합니다
   */
  destroy(): void {
    if (this.textarea.parentNode) {
      this.textarea.parentNode.removeChild(this.textarea)
    }
  }
}
