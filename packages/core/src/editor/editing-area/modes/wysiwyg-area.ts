import type { SelectionManager } from '@/core/selection-manager'
import { WysiwygEvents, type EventBus } from '@/core'
import type { EditingArea, EditingAreaConfig, IRContent } from '../types'

export interface WysiwygAreaConfig extends EditingAreaConfig {
  /**
   * 선택 작업을 위한 `SelectionManager` 인스턴스
   */
  selectionManager?: SelectionManager

  /**
   * 이벤트 발행을 위한 `EventBus`
   */
  eventBus?: EventBus
}

export class WysiwygArea implements EditingArea {
  private element: HTMLDivElement
  private container: HTMLElement
  private selectionManager?: SelectionManager
  private eventBus?: EventBus
  private visible: boolean = false

  constructor(config: WysiwygAreaConfig) {
    this.container = config.container
    this.selectionManager = config.selectionManager
    this.eventBus = config.eventBus

    this.element = document.createElement('div')
    this.element.contentEditable = 'true'
    this.element.className = config.className || 'modern-wysiwyg-area'

    if (config.minHeight) {
      this.element.style.minHeight = `${config.minHeight}px`
    }

    this.element.style.width = '100%'
    this.element.style.height = '100%'
    this.element.style.minHeight = config.minHeight
      ? `${config.minHeight}px`
      : '300px'
    this.element.style.padding = '10px'
    this.element.style.border = '1px solid #ddd'
    this.element.style.outline = 'none'
    this.element.style.overflow = 'auto'
    this.element.style.boxSizing = 'border-box'
    this.element.style.display = 'none'

    this.element.innerHTML = '<p><br></p>'
    this.element.spellcheck = config.spellCheck !== false

    this.container.appendChild(this.element)
    this.initializeEventListeners()

    if (config.autoResize) {
      this.setupAutoResize()
    }
  }

  /**
   * IR 형식(HTML)으로 콘텐츠를 가져옵니다
   */
  async getContent(): Promise<IRContent> {
    return this.element.innerHTML
  }

  /**
   * IR 형식(HTML)에서 콘텐츠를 설정합니다
   */
  async setContent(content: IRContent): Promise<void> {
    if (!content || content === '<br>' || content === '<p></p>') {
      this.element.innerHTML = '<p><br></p>'
      return
    }

    this.element.innerHTML = content

    if (!this.element.firstChild) {
      this.element.innerHTML = '<p><br></p>'
    }
  }

  /**
   * WYSIWYG 편집 영역을 표시합니다
   */
  async show(): Promise<void> {
    this.element.style.display = 'block'
    this.visible = true

    if (this.eventBus) {
      this.eventBus.emit(WysiwygEvents.WYSIWYG_AREA_SHOWN)
    }
  }

  /**
   * WYSIWYG 편집 영역을 숨깁니다
   */
  async hide(): Promise<void> {
    this.element.style.display = 'none'
    this.visible = false

    if (this.eventBus) {
      this.eventBus.emit(WysiwygEvents.WYSIWYG_AREA_HIDDEN)
    }
  }

  /**
   * 편집 영역에 포커스를 설정합니다
   */
  focus(): void {
    this.element.focus()

    if (this.selectionManager) {
      this.selectionManager.restoreSelection()
    }
  }

  /**
   * 편집 가능 여부를 설정합니다
   */
  setEditable(enabled: boolean): void {
    this.element.contentEditable = enabled ? 'true' : 'false'
  }

  /**
   * 맞춤법 검사 활성화 여부를 설정합니다
   */
  setSpellCheck(enabled: boolean): void {
    this.element.spellcheck = enabled
  }

  /**
   * 원시 HTML 콘텐츠를 가져옵니다
   */
  getRawContent(): string {
    return this.element.innerHTML
  }

  /**
   * 원시 HTML 콘텐츠를 설정합니다
   */
  setRawContent(content: string): void {
    this.element.innerHTML = content
  }

  /**
   * 현재 표시 여부를 확인합니다
   */
  isVisible(): boolean {
    return this.visible
  }

  /**
   * `contentEditable` 요소를 가져옵니다
   */
  getElement(): HTMLElement {
    return this.element
  }

  /**
   * 현재 선택 영역에 HTML을 삽입합니다
   * CJK 지원 개선을 위해 `SelectionManager`를 사용합니다
   */
  insertHTML(html: string): boolean {
    if (this.selectionManager) {
      return this.selectionManager.insertHTML(html)
    }

    try {
      document.execCommand('insertHTML', false, html)
      return true
    } catch (e) {
      console.error('HTML 삽입 실패:', e)
      return false
    }
  }

  /**
   * 현재 선택 영역에 텍스트를 삽입합니다
   * CJK 지원 개선을 위해 `SelectionManager`를 사용합니다
   */
  insertText(text: string): boolean {
    if (this.selectionManager) {
      return this.selectionManager.insertText(text)
    }

    try {
      document.execCommand('insertText', false, text)
      return true
    } catch (e) {
      console.error('텍스트 삽입 실패:', e)
      return false
    }
  }

  /**
   * 서식 명령을 실행합니다 (굵게, 기울임 등)
   */
  execCommand(command: string, value?: string): boolean {
    try {
      return document.execCommand(command, false, value)
    } catch (e) {
      console.error(`명령 ${command} 실행 실패:`, e)
      return false
    }
  }

  /**
   * 선택된 텍스트를 가져옵니다
   */
  getSelectedText(): string {
    if (this.selectionManager) {
      return this.selectionManager.getSelectedText()
    }

    const selection = window.getSelection()

    return selection ? selection.toString() : ''
  }

  /**
   * 선택된 HTML을 가져옵니다
   */
  getSelectedHTML(): string {
    if (this.selectionManager) {
      return this.selectionManager.getSelectedHTML()
    }

    const selection = window.getSelection()

    if (!selection || selection.rangeCount === 0) {
      return ''
    }

    const range = selection.getRangeAt(0)
    const fragment = range.cloneContents()
    const div = document.createElement('div')
    div.appendChild(fragment)

    return div.innerHTML
  }

  /**
   * 현재 선택 영역을 저장합니다
   */
  saveSelection(): void {
    if (this.selectionManager) {
      this.selectionManager.saveSelection()
    }
  }

  /**
   * 저장된 선택 영역을 복원합니다
   */
  restoreSelection(): void {
    if (this.selectionManager) {
      this.selectionManager.restoreSelection()
    }
  }

  /**
   * IME 입력이 진행 중인지 확인합니다
   */
  isComposing(): boolean {
    if (this.selectionManager) {
      return this.selectionManager.getIsComposing()
    }

    return false
  }

  /**
   * 이벤트 리스너를 초기화합니다
   */
  private initializeEventListeners(): void {
    this.element.addEventListener('input', () => {
      if (this.eventBus) {
        this.eventBus.emit(WysiwygEvents.WYSIWYG_CONTENT_CHANGED, {
          content: this.element.innerHTML,
        })
      }
    })

    this.element.addEventListener('focus', () => {
      if (this.eventBus) {
        this.eventBus.emit(WysiwygEvents.WYSIWYG_FOCUSED)
      }
    })

    this.element.addEventListener('blur', () => {
      if (this.eventBus) {
        this.eventBus.emit(WysiwygEvents.WYSIWYG_BLURRED)
      }
    })

    document.addEventListener('selectionchange', () => {
      const selection = window.getSelection()
      if (selection && this.element.contains(selection.anchorNode as Node)) {
        if (this.eventBus) {
          this.eventBus.emit(WysiwygEvents.WYSIWYG_SELECTION_CHANGED)
        }
      }
    })

    this.element.addEventListener('paste', (event) => {
      if (this.eventBus) {
        this.eventBus.emit(WysiwygEvents.WYSIWYG_PASTE, { event })
      }
    })

    this.element.addEventListener('keydown', (event) => {
      if (this.eventBus) {
        this.eventBus.emit(WysiwygEvents.WYSIWYG_KEYDOWN, { event })
      }
    })

    this.element.addEventListener('keyup', (event) => {
      if (this.eventBus) {
        this.eventBus.emit(WysiwygEvents.WYSIWYG_KEYUP, { event })
      }
    })
  }

  /**
   * 자동 크기 조정 기능을 설정합니다
   */
  private setupAutoResize(): void {
    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
          if (this.eventBus) {
            this.eventBus.emit(WysiwygEvents.WYSIWYG_RESIZED, {
              width: entry.contentRect.width,
              height: entry.contentRect.height,
            })
          }
        }
      })

      observer.observe(this.element)
    }
  }

  /**
   * 리소스를 정리합니다
   */
  destroy(): void {
    if (this.element.parentNode) {
      this.element.parentNode.removeChild(this.element)
    }
  }
}
