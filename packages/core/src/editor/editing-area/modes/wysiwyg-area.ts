import { logger } from '@/core/logger'
import { createErrorReporter, type ErrorReporter } from '@/core/errors'
import type { SelectionManager } from '@/core/selection-manager'
import { WysiwygEvents, type EventBus } from '@/core'
import { sagakSchema } from '@/model/schema'
import { parseHtml, toHtml } from '@/model/storage'
import type { EditingArea, EditingAreaConfig, IRContent } from '../types'
import { resolveSanitizer, type Sanitizer } from '../sanitizer'
import {
  insertHTMLAtSelection,
  insertTextAtSelection,
} from '@/core/commands/range-insert'
import { installStoredMarks } from '@/core/commands/stored-marks'

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
  private documentSelectionChangeHandler?: () => void
  private resizeObserver?: ResizeObserver
  private sanitize: Sanitizer
  private reportError: ErrorReporter
  private storedMarksCleanup?: () => void

  constructor(config: WysiwygAreaConfig) {
    this.container = config.container
    this.selectionManager = config.selectionManager
    this.eventBus = config.eventBus
    this.sanitize = resolveSanitizer(config.sanitize)
    this.reportError = this.eventBus
      ? createErrorReporter(this.eventBus, 'wysiwyg-area')
      : (error, message) => logger.error(message, error)

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
    // 보류 서식(stored marks): collapsed 커서 토글 후 입력에 서식을 적용합니다
    this.storedMarksCleanup = installStoredMarks(this.element)

    if (config.autoResize) {
      this.setupAutoResize()
    }
  }

  /**
   * IR 형식(HTML)으로 콘텐츠를 가져옵니다
   */
  async getContent(): Promise<IRContent> {
    return parseHtml(this.element.innerHTML, sagakSchema, document)
  }

  /**
   * IR 형식(HTML)에서 콘텐츠를 설정합니다
   */
  async setContent(content: IRContent): Promise<void> {
    /*
     * 소독은 **HTML 경계에서** 합니다. 모델은 스키마를 통과한 것이라 위험한
     * 것이 이미 없지만, 직렬화한 문자열을 DOM 에 넣는 것은 여전히 경계라
     * 지나온 길을 그대로 지킵니다.
     */
    const html = toHtml(content, sagakSchema, document)

    if (!html) {
      this.element.innerHTML = '<p><br></p>'
      return
    }

    /*
     * **빈 블록에는 캐럿이 설 자리가 필요합니다.**
     *
     * 모델의 빈 문단은 `<p></p>` 로 직렬화되는데, 그대로 넣으면 브라우저가
     * 캐럿을 놓지 못해 그 줄에 글을 쓸 수 없습니다. 그래서 표시할 때만 채움용
     * `<br>` 을 넣습니다 — 모델에는 없는 것이고, 다시 읽을 때 스키마가 걷어내므로
     * 저장물에도 안 남습니다.
     */
    this.element.innerHTML = this.sanitize(
      html.replace(/<(p|h[1-6])([^>]*)><\/\1>/g, '<$1$2><br></$1>')
    )

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
      return insertHTMLAtSelection(html)
    } catch (e) {
      this.reportError(e, 'HTML 삽입 실패:')
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
      return insertTextAtSelection(text)
    } catch (e) {
      this.reportError(e, '텍스트 삽입 실패:')
      return false
    }
  }

  /**
   * 네이티브 `execCommand`를 직접 실행합니다 (탈출구)
   *
   * @deprecated 서식은 커맨드 레지스트리(`EditorCore.getCommandRegistry()`)를
   * 통해 실행하세요. 이 메서드는 레지스트리가 다루지 않는 브라우저 명령을
   * 위한 하위 호환 탈출구로만 남아 있습니다.
   */
  execCommand(command: string, value?: string): boolean {
    try {
      return document.execCommand(command, false, value)
    } catch (e) {
      this.reportError(e, `명령 ${command} 실행 실패:`)
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
      if (!this.eventBus) return

      /*
       * `content` 는 **읽을 때** 직렬화합니다.
       *
       * 이전에는 여기서 `this.element.innerHTML` 을 바로 담았습니다. 그러면
       * 키를 누를 때마다 문서 전체가 문자열로 만들어지는데, 재 보니 2000문단
       * (222 KB) 에서 키 하나당 0.925 ms 였습니다. 문서 크기에 비례합니다.
       *
       * 그런데 **구독자 둘 다 이 값을 읽지 않습니다** — `EditorCore` 는
       * `updateFormattingState()` 로 넘기고(인자를 받지 않습니다), 자동 저장은
       * `() => scheduleSave()` 입니다. 즉 아무도 안 보는 문자열을 매번
       * 만들고 있었습니다.
       *
       * 게터로 두면 계약은 그대로이고 아무도 안 읽으면 비용이 0 입니다.
       */
      const element = this.element
      this.eventBus.emit(WysiwygEvents.WYSIWYG_CONTENT_CHANGED, {
        get content(): string {
          return element.innerHTML
        },
      })
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

    this.documentSelectionChangeHandler = () => {
      const selection = window.getSelection()
      if (selection && this.element.contains(selection.anchorNode as Node)) {
        if (this.eventBus) {
          this.eventBus.emit(WysiwygEvents.WYSIWYG_SELECTION_CHANGED)
        }
      }
    }
    document.addEventListener(
      'selectionchange',
      this.documentSelectionChangeHandler
    )

    this.element.addEventListener('paste', (event) => {
      if (this.eventBus) {
        this.eventBus.emit(WysiwygEvents.WYSIWYG_PASTE, { event })
      }
      this.handleSanitizedPaste(event)
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
   * 붙여넣기된 HTML을 정화한 뒤 삽입합니다
   *
   * `text/html` 데이터가 있을 때만 개입하여 기본 동작을 취소하고 정화된
   * HTML을 삽입합니다. 이미지 붙여넣기는 이미지 업로드 플러그인이 처리하도록
   * 건너뛰고, 순수 텍스트는 브라우저 기본 동작(안전함)에 맡깁니다.
   */
  private handleSanitizedPaste(event: ClipboardEvent): void {
    if (event.defaultPrevented) {
      return
    }

    const clipboard = event.clipboardData
    if (!clipboard) {
      return
    }

    // 이미지 붙여넣기는 이미지 업로드 플러그인이 처리합니다
    const hasImage = Array.from(clipboard.items ?? []).some((item) =>
      item.type.startsWith('image/')
    )
    if (hasImage) {
      return
    }

    const html = clipboard.getData('text/html')
    if (!html) {
      // 순수 텍스트 붙여넣기는 브라우저 기본 동작에 맡깁니다
      return
    }

    event.preventDefault()
    const clean = this.sanitize(html)

    if (this.selectionManager) {
      this.selectionManager.insertHTML(clean)
    } else {
      insertHTMLAtSelection(clean)
    }
  }

  /**
   * 자동 크기 조정 기능을 설정합니다
   */
  private setupAutoResize(): void {
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          if (this.eventBus) {
            this.eventBus.emit(WysiwygEvents.WYSIWYG_RESIZED, {
              width: entry.contentRect.width,
              height: entry.contentRect.height,
            })
          }
        }
      })

      this.resizeObserver.observe(this.element)
    }
  }

  /**
   * 리소스를 정리합니다
   *
   * 요소를 DOM에서 제거하고, `document`에 등록한 `selectionchange` 리스너와
   * `ResizeObserver`를 해제합니다. 요소에 직접 등록한 리스너는 요소가
   * 참조 해제되면 함께 정리됩니다.
   */
  destroy(): void {
    this.storedMarksCleanup?.()
    this.storedMarksCleanup = undefined

    if (this.documentSelectionChangeHandler) {
      document.removeEventListener(
        'selectionchange',
        this.documentSelectionChangeHandler
      )
      this.documentSelectionChangeHandler = undefined
    }

    if (this.resizeObserver) {
      this.resizeObserver.disconnect()
      this.resizeObserver = undefined
    }

    if (this.element.parentNode) {
      this.element.parentNode.removeChild(this.element)
    }
  }
}
