import { EventBus } from './event-bus'
import { PluginManager } from './plugin-manager'
import { SelectionManager } from './selection-manager'
import { CoreEvents, WysiwygEvents } from './events'
import type {
  Plugin,
  EditorContext,
  EditorConfig,
  EditingAreaManager,
  EditingMode,
} from './types'

/**
 * 애플리케이션 상태
 */
export const AppStatus = {
  /** 준비되지 않음 */
  NOT_READY: 'not_ready',
  /** 준비 완료 */
  READY: 'ready',
} as const

export type AppStatusValue = (typeof AppStatus)[keyof typeof AppStatus]

/**
 * EditorCore 설정
 */
export interface EditorCoreConfig extends EditorConfig {
  /**
   * `SelectionManager`를 위한 편집 가능한 요소
   */
  element?: HTMLElement

  /**
   * 초기화 시 등록할 커스텀 플러그인들
   */
  plugins?: Plugin[]

  /**
   *
   * 편집 영역을 위한 컨테이너 요소
   * 제공되면 `EditingAreaManager`가 생성됩니다
   */
  editingAreaContainer?: HTMLElement

  /**
   * 초기 편집 모드 (기본값: `'wysiwyg'`)
   */
  initialMode?: EditingMode

  /**
   * 편집 영역의 최소 높이
   */
  minHeight?: number

  /**
   * 편집 영역의 자동 크기 조정 활성화
   */
  autoResize?: boolean

  /**
   * 맞춤법 검사 활성화 (기본값: true)
   */
  spellCheck?: boolean
}

/**
 * EditorCore
 *
 * `EventBus`, `PluginManager`, `SelectionManager`를 결합한 파사드입니다
 * 플러그인 기반 에디터 아키텍처를 위한 통합 API를 제공합니다
 *
 * @example
 * ```typescript
 * const core = new EditorCore({
 *   element: document.getElementById('editor'),
 *   plugins: [BoldPlugin, ItalicPlugin]
 * });
 *
 * await core.run();
 * core.exec('BOLD_CLICKED');
 * ```
 */
export class EditorCore {
  private eventBus: EventBus
  private pluginManager: PluginManager
  private selectionManager?: SelectionManager
  private editingAreaManager?: EditingAreaManager
  private context: EditorContext
  private config: EditorCoreConfig
  private status: AppStatusValue = AppStatus.NOT_READY
  private pendingPlugins: Plugin[] = []

  /**
   * `EditorCore` 인스턴스를 생성합니다
   *
   * @param config 설정 옵션
   */
  constructor(config: EditorCoreConfig = {}) {
    this.config = config
    this.eventBus = new EventBus()

    this.context = {
      eventBus: this.eventBus,
      config: this.config,
      element: config.element,
    }

    if (config.element) {
      this.selectionManager = new SelectionManager(config.element)
      this.context.selectionManager = this.selectionManager
      this.setupFormattingStateTracking()
    }

    this.pluginManager = new PluginManager(this.context)
  }

  /**
   * 플러그인을 등록합니다
   *
   * @param plugin 등록할 플러그인
   * @returns 플러그인이 초기화될 때 `resolve`되는 `Promise`
   *
   * @example
   * ```typescript
   * await core.registerPlugin(BoldPlugin);
   * ```
   */
  async registerPlugin(plugin: Plugin): Promise<void> {
    if (this.pluginManager.has(plugin.name)) {
      throw new Error(`Plugin "${plugin.name}" is already registered`)
    }

    if (this.pendingPlugins.some((p) => p.name === plugin.name)) {
      throw new Error(`Plugin "${plugin.name}" is already pending registration`)
    }

    if (this.status === AppStatus.READY) {
      await this.pluginManager.register(plugin)
    } else {
      this.pendingPlugins.push(plugin)
    }
  }

  /**
   * 애플리케이션을 실행합니다
   * 등록된 모든 플러그인을 초기화하고 상태를 `READY`로 변경합니다
   *
   * @example
   * ```typescript
   * await core.run();
   * console.log('Application ready!');
   * ```
   */
  async run(): Promise<void> {
    if (this.config.editingAreaContainer) {
      // 순환 의존성을 피하기 위해 동적 import 사용
      const { EditingAreaManager } =
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore - Circular dependency between core and editor packages
        await import('@/editor/editing-area/editing-area-manager')

      this.editingAreaManager = new EditingAreaManager({
        container: this.config.editingAreaContainer,
        initialMode: this.config.initialMode || 'wysiwyg',
        eventBus: this.eventBus,
        selectionManager: this.selectionManager,
        minHeight: this.config.minHeight,
        autoResize: this.config.autoResize,
        spellCheck: this.config.spellCheck,
      })

      await this.editingAreaManager.initialize()
      this.context.editingAreaManager = this.editingAreaManager

      // Set context.element to the current editing area element
      const currentArea = this.editingAreaManager.getCurrentArea()
      if (currentArea) {
        this.context.element = currentArea.getElement()
        this.selectionManager = new SelectionManager(this.context.element)
        this.context.selectionManager = this.selectionManager
        this.setupFormattingStateTracking()
      }
    }

    for (const plugin of this.pendingPlugins) {
      await this.pluginManager.register(plugin)
    }
    this.pendingPlugins = []

    this.status = AppStatus.READY

    if (this.config.plugins) {
      for (const plugin of this.config.plugins) {
        await this.registerPlugin(plugin)
      }
    }

    this.eventBus.emit(CoreEvents.APP_READY)
  }

  /**
   * 메시지를 실행합니다 (이벤트 발행)
   *
   * @param message 메시지 이름
   * @param args 핸들러에 전달할 인자
   * @returns 메시지가 취소되지 않으면 `true`
   *
   * @example
   * ```typescript
   * core.exec('BOLD_CLICKED');
   * core.exec('INSERT_HTML', '<strong>Bold</strong>');
   * ```
   */
  exec(message: string, ...args: unknown[]): boolean {
    return this.eventBus.emit(message, ...args)
  }

  /**
   * 지연 후 메시지를 실행합니다
   *
   * @param message 메시지 이름
   * @param delay 밀리초 단위 지연 시간
   * @param args 핸들러에 전달할 인자
   *
   * @example
   * ```typescript
   * core.delayedExec('SAVE', 1000);
   * ```
   */
  delayedExec(message: string, delay: number, ...args: unknown[]): void {
    setTimeout(() => {
      this.exec(message, ...args)
    }, delay)
  }

  /**
   * 메시지를 트리거하는 브라우저 이벤트를 등록합니다
   *
   * @param element 이벤트를 연결할 요소
   * @param eventName 브라우저 이벤트 이름 (예: `'click'`)
   * @param message 발행할 메시지
   * @param args 메시지와 함께 전달할 인자
   * @returns 리스너를 제거하는 정리 함수
   *
   * @example
   * ```typescript
   * const cleanup = core.registerBrowserEvent(
   *   button,
   *   'click',
   *   'BOLD_CLICKED'
   * );
   *
   * // Later: cleanup();
   * ```
   */
  registerBrowserEvent(
    element: HTMLElement,
    eventName: string,
    message: string,
    args: unknown[] = []
  ): () => void {
    const handler = (event: Event) => {
      this.exec(message, ...args, event)
    }

    element.addEventListener(eventName, handler)

    return () => {
      element.removeEventListener(eventName, handler)
    }
  }

  /**
   * `EventBus` 인스턴스를 가져옵니다
   */
  getEventBus(): EventBus {
    return this.eventBus
  }

  /**
   * `PluginManager` 인스턴스를 가져옵니다
   */
  getPluginManager(): PluginManager {
    return this.pluginManager
  }

  /**
   * `SelectionManager` 인스턴스를 가져옵니다
   */
  getSelectionManager(): SelectionManager | undefined {
    return this.selectionManager
  }

  /**
   * `EditingAreaManager` 인스턴스를 가져옵니다
   */
  getEditingAreaManager(): EditingAreaManager | undefined {
    return this.editingAreaManager
  }

  /**
   * 에디터 컨텍스트를 가져옵니다
   */
  getContext(): EditorContext {
    return this.context
  }

  /**
   * 애플리케이션 상태를 가져옵니다
   */
  getStatus(): AppStatusValue {
    return this.status
  }

  /**
   * 애플리케이션이 준비되었는지 확인합니다
   */
  isReady(): boolean {
    return this.status === AppStatus.READY
  }

  /**
   * 편집 모드를 전환합니다
   *
   * @param mode 전환할 편집 모드
   *
   * @example
   * ```typescript
   * await core.switchMode('html');
   * await core.switchMode('text');
   * await core.switchMode('wysiwyg');
   * ```
   */
  async switchMode(mode: EditingMode): Promise<void> {
    if (!this.editingAreaManager) {
      throw new Error('EditingAreaManager not initialized')
    }

    await this.editingAreaManager.switchMode(mode)
  }

  /**
   * 현재 편집 모드를 가져옵니다
   */
  getCurrentMode(): EditingMode | undefined {
    return this.editingAreaManager?.getCurrentMode()
  }

  /**
   * 현재 편집 영역의 콘텐츠를 가져옵니다
   */
  async getContent(): Promise<string> {
    if (!this.editingAreaManager) {
      throw new Error('EditingAreaManager not initialized')
    }

    return await this.editingAreaManager.getContent()
  }

  /**
   * 현재 편집 영역에 콘텐츠를 설정합니다
   *
   * @param content `IR` 형식의 콘텐츠 (`HTML`)
   */
  async setContent(content: string): Promise<void> {
    if (!this.editingAreaManager) {
      throw new Error('EditingAreaManager not initialized')
    }

    await this.editingAreaManager.setContent(content)
  }

  /**
   * 현재 편집 영역에 포커스를 설정합니다
   */
  focus(): void {
    this.editingAreaManager?.focus()
  }

  /**
   * 편집 가능 상태를 설정합니다
   *
   * @param enabled 편집 활성화 여부
   */
  setEditable(enabled: boolean): void {
    this.editingAreaManager?.setEditable(enabled)
  }

  /**
   * 서식 상태 추적을 설정합니다
   * 선택 영역 변경을 감지하고 서식 상태 업데이트를 발행합니다
   */
  private setupFormattingStateTracking(): void {
    let rafId: number | null = null
    let lastFormattingState: {
      isBold: boolean
      isItalic: boolean
      isUnderline: boolean
      isStrikeThrough: boolean
      isSubscript: boolean
      isSuperscript: boolean
    } | null = null

    const emptyFormattingState = {
      isBold: false,
      isItalic: false,
      isUnderline: false,
      isStrikeThrough: false,
      isSubscript: false,
      isSuperscript: false,
    }

    const isStateEqual = (
      a: typeof emptyFormattingState,
      b: typeof emptyFormattingState | null
    ): boolean => {
      if (!b) return false
      return (
        a.isBold === b.isBold &&
        a.isItalic === b.isItalic &&
        a.isUnderline === b.isUnderline &&
        a.isStrikeThrough === b.isStrikeThrough &&
        a.isSubscript === b.isSubscript &&
        a.isSuperscript === b.isSuperscript
      )
    }

    const isContentEmpty = (): boolean => {
      const element = this.context.element
      if (!element) return true

      const textContent = element.textContent || ''
      return textContent.trim().length === 0
    }

    const cleanupEmptyFormatting = (): void => {
      const element = this.context.element
      if (!element) return

      element.innerHTML = '<p><br></p>'

      const selection = window.getSelection()
      if (selection) {
        const p = element.querySelector('p')
        if (p) {
          const range = document.createRange()
          range.setStart(p, 0)
          range.collapse(true)
          selection.removeAllRanges()
          selection.addRange(range)
        }
      }
    }

    const isSelectionInEditor = (): boolean => {
      const element = this.context.element
      if (!element) return false

      const selection = window.getSelection()
      if (!selection || selection.rangeCount === 0) return false

      const anchorNode = selection.anchorNode
      if (!anchorNode) return false

      return element.contains(anchorNode)
    }

    const updateFormattingState = () => {
      if (this.selectionManager?.getIsComposing()) {
        return
      }

      if (rafId !== null) {
        cancelAnimationFrame(rafId)
      }

      rafId = requestAnimationFrame(() => {
        rafId = null

        // Skip update if selection is outside editor (e.g., in dropdown)
        if (!isSelectionInEditor()) {
          return
        }

        if (isContentEmpty()) {
          cleanupEmptyFormatting()
          if (!isStateEqual(emptyFormattingState, lastFormattingState)) {
            lastFormattingState = emptyFormattingState
            this.eventBus.emit(CoreEvents.FORMATTING_STATE_CHANGED, emptyFormattingState)
          }
          return
        }

        const formattingState = {
          isBold: document.queryCommandState('bold'),
          isItalic: document.queryCommandState('italic'),
          isUnderline: document.queryCommandState('underline'),
          isStrikeThrough: document.queryCommandState('strikeThrough'),
          isSubscript: document.queryCommandState('subscript'),
          isSuperscript: document.queryCommandState('superscript'),
        }

        if (!isStateEqual(formattingState, lastFormattingState)) {
          lastFormattingState = formattingState
          this.eventBus.emit(CoreEvents.FORMATTING_STATE_CHANGED, formattingState)
        }
      })
    }

    document.addEventListener('selectionchange', updateFormattingState)
    this.eventBus.on(CoreEvents.STYLE_CHANGED, 'after', updateFormattingState)
    this.eventBus.on(CoreEvents.CONTENT_RESTORED, 'after', updateFormattingState)
    this.eventBus.on(WysiwygEvents.WYSIWYG_CONTENT_CHANGED, 'after', updateFormattingState)
    updateFormattingState()
  }

  /**
   * 애플리케이션을 정리합니다
   * 모든 플러그인과 이벤트 리스너를 정리합니다
   */
  destroy(): void {
    this.pluginManager.destroyAll()

    if (this.editingAreaManager) {
      this.editingAreaManager.destroy()
      this.editingAreaManager = undefined
    }

    this.status = AppStatus.NOT_READY
  }
}
