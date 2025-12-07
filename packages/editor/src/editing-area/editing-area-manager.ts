import type { EditingArea, EditingMode, IRContent } from './types'
import type { WysiwygArea } from './modes/wysiwyg-area'
import type { HtmlSourceArea } from './modes/html-source-area'
import type { TextArea } from './modes/text-area'
import { EditingAreaEvents, type EventBus } from '@sagak/core'
import type { SelectionManager } from '@sagak/core/selection-manager'

export interface EditingAreaManagerConfig {
  /**
   * 편집 영역을 위한 컨테이너 요소
   */
  container: HTMLElement

  /**
   * 초기 편집 모드
   */
  initialMode?: EditingMode

  /**
   * 이벤트 발행을 위한 `EventBus`
   */
  eventBus?: EventBus

  /**
   * WYSIWYG 모드를 위한 `SelectionManager`
   */
  selectionManager?: SelectionManager

  /**
   * 각 모드에 대한 사용자 정의 클래스 이름
   */
  classNames?: {
    wysiwyg?: string
    html?: string
    text?: string
  }

  /**
   * 편집 영역의 최소 높이
   */
  minHeight?: number

  /**
   * 편집 영역의 자동 크기 조정 활성화
   */
  autoResize?: boolean
}

export class EditingAreaManager {
  private eventBus?: EventBus
  private selectionManager?: SelectionManager

  private areas: Map<EditingMode, EditingArea> = new Map()
  private currentMode: EditingMode
  private currentContent: IRContent = ''

  private WysiwygAreaClass?: typeof WysiwygArea
  private HtmlSourceAreaClass?: typeof HtmlSourceArea
  private TextAreaClass?: typeof TextArea

  constructor(config: EditingAreaManagerConfig) {
    this.eventBus = config.eventBus
    this.selectionManager = config.selectionManager
    this.currentMode = config.initialMode || 'wysiwyg'

    this.config = {
      container: config.container,
      classNames: config.classNames || {},
      minHeight: config.minHeight,
      autoResize: config.autoResize,
    }
  }

  private config: {
    container: HTMLElement
    classNames: {
      wysiwyg?: string
      html?: string
      text?: string
    }
    minHeight?: number
    autoResize?: boolean
  }

  /**
   * 관리자를 초기화합니다
   * 초기 편집 영역을 로드합니다
   */
  async initialize(): Promise<void> {
    await this.ensureAreaLoaded(this.currentMode)

    const currentArea = this.areas.get(this.currentMode)
    if (currentArea) {
      await currentArea.show()
    }

    if (this.eventBus) {
      this.eventBus.emit(EditingAreaEvents.EDITING_AREA_INITIALIZED, {
        mode: this.currentMode,
      })
    }
  }

  /**
   * 다른 편집 모드로 전환합니다
   */
  async switchMode(newMode: EditingMode): Promise<void> {
    if (newMode === this.currentMode) {
      return
    }

    const oldMode = this.currentMode

    if (this.eventBus) {
      this.eventBus.emit(EditingAreaEvents.EDITING_AREA_MODE_CHANGING, {
        from: oldMode,
        to: newMode,
      })
    }

    const currentArea = this.areas.get(this.currentMode)
    if (currentArea) {
      this.currentContent = await currentArea.getContent()
      await currentArea.hide()
    }

    await this.ensureAreaLoaded(newMode)

    const newArea = this.areas.get(newMode)
    if (newArea) {
      await newArea.setContent(this.currentContent)
      await newArea.show()
      newArea.focus()
    }

    this.currentMode = newMode

    if (this.eventBus) {
      this.eventBus.emit(EditingAreaEvents.EDITING_AREA_MODE_CHANGED, {
        from: oldMode,
        to: newMode,
      })
    }
  }

  /**
   * 현재 편집 모드를 가져옵니다
   */
  getCurrentMode(): EditingMode {
    return this.currentMode
  }

  /**
   * IR 형식으로 현재 콘텐츠를 가져옵니다
   */
  async getContent(): Promise<IRContent> {
    const currentArea = this.areas.get(this.currentMode)

    if (currentArea) {
      this.currentContent = await currentArea.getContent()
    }

    return this.currentContent
  }

  /**
   * 현재 편집 영역에 콘텐츠를 설정합니다
   */
  async setContent(content: IRContent): Promise<void> {
    this.currentContent = content

    const currentArea = this.areas.get(this.currentMode)

    if (currentArea) {
      await currentArea.setContent(content)
    }
  }

  /**
   * 현재 편집 영역에 포커스를 설정합니다
   */
  focus(): void {
    const currentArea = this.areas.get(this.currentMode)

    if (currentArea) {
      currentArea.focus()
    }
  }

  /**
   * 편집 가능 여부를 설정합니다
   */
  setEditable(enabled: boolean): void {
    for (const area of this.areas.values()) {
      area.setEditable(enabled)
    }
  }

  /**
   * 현재 편집 영역 인스턴스를 가져옵니다
   */
  getCurrentArea(): EditingArea | undefined {
    return this.areas.get(this.currentMode)
  }

  /**
   * 특정 편집 영역 인스턴스를 가져옵니다
   * 아직 로드되지 않은 경우 로드합니다
   */
  async getArea(mode: EditingMode): Promise<EditingArea | undefined> {
    await this.ensureAreaLoaded(mode)

    return this.areas.get(mode)
  }

  /**
   * 편집 모드가 로드되었는지 확인합니다
   */
  isAreaLoaded(mode: EditingMode): boolean {
    return this.areas.has(mode)
  }

  /**
   * 편집 영역이 로드되었는지 확인합니다
   * 필요한 경우 지연 로드합니다
   */
  private async ensureAreaLoaded(mode: EditingMode): Promise<void> {
    if (this.areas.has(mode)) {
      return
    }

    await this.loadArea(mode)
  }

  /**
   * 특정 편집 영역을 로드합니다
   */
  private async loadArea(mode: EditingMode): Promise<void> {
    let area: EditingArea

    switch (mode) {
      case 'wysiwyg': {
        if (!this.WysiwygAreaClass) {
          const module = await import('./modes/wysiwyg-area')

          this.WysiwygAreaClass = module.WysiwygArea
        }

        area = new this.WysiwygAreaClass({
          container: this.config.container,
          className: this.config.classNames.wysiwyg,
          minHeight: this.config.minHeight,
          autoResize: this.config.autoResize,
          selectionManager: this.selectionManager,
          eventBus: this.eventBus,
        })

        break
      }

      case 'html': {
        if (!this.HtmlSourceAreaClass) {
          const module = await import('./modes/html-source-area')

          this.HtmlSourceAreaClass = module.HtmlSourceArea
        }

        area = new this.HtmlSourceAreaClass({
          container: this.config.container,
          className: this.config.classNames.html,
          minHeight: this.config.minHeight,
          autoResize: this.config.autoResize,
        })

        break
      }

      case 'text': {
        if (!this.TextAreaClass) {
          const module = await import('./modes/text-area')
          this.TextAreaClass = module.TextArea
        }

        area = new this.TextAreaClass({
          container: this.config.container,
          className: this.config.classNames.text,
          minHeight: this.config.minHeight,
          autoResize: this.config.autoResize,
        })

        break
      }

      default:
        throw new Error(`알 수 없는 편집 모드: ${mode}`)
    }

    this.areas.set(mode, area)
  }

  /**
   * 특정 편집 영역을 언로드합니다
   */
  async unloadArea(mode: EditingMode): Promise<void> {
    if (mode === this.currentMode) {
      throw new Error('현재 편집 영역은 언로드할 수 없습니다')
    }

    const area = this.areas.get(mode)

    if (area) {
      area.destroy()
      this.areas.delete(mode)
    }
  }

  /**
   * 리소스를 정리합니다
   */
  destroy(): void {
    for (const area of this.areas.values()) {
      area.destroy()
    }

    this.areas.clear()

    if (this.eventBus) {
      this.eventBus.emit(EditingAreaEvents.EDITING_AREA_DESTROYED)
    }
  }
}
