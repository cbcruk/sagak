import type { Node as PMNode } from 'prosemirror-model'
import { sagakSchema } from '@/model/schema'
import { toHtml, parseHtml, toJSON, fromJSON } from '@/model/storage'
import type { DocumentJSON } from '@/model/storage'
import { EventBus } from './event-bus'
import { PluginManager } from './plugin-manager'
import { trackComposition } from './composition'
import type { CompositionTracker } from './composition'
import { CoreEvents } from './events'
import type {
  Plugin,
  EditorContext,
  EditorConfig,
  EditingAreaManager,
  EditingMode,
} from './types'
import { setLogLevel, type LogLevel } from './logger'
import { type EditorErrorData } from './errors'
import { CommandRegistry } from './command-registry'
import { registerModelCommands } from '@/model/register'
import { registerDefaultCommands } from './default-commands'

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

  /**
   * 라이브러리 로그 레벨 (기본값: `'warn'`)
   *
   * 프로덕션에서 로그를 억제하려면 `'silent'`을 사용하세요.
   * 전역 로거에 적용됩니다.
   */
  logLevel?: LogLevel

  /**
   * 오류 콜백
   *
   * 플러그인/코어에서 오류가 포착될 때 호출됩니다.
   * `CoreEvents.ERROR` 이벤트를 구독하는 것과 동일합니다.
   */
  onError?: (data: EditorErrorData) => void

  /**
   * 레거시 `execCommand` 폴백 사용 여부 (기본값: `true`)
   *
   * 자체 구현이 판단할 수 없는 상황에서 브라우저 기본 동작으로 위임하는
   * 안전망입니다. `false`로 두면 deprecated된 `execCommand`/`queryCommand*`를
   * 전혀 호출하지 않습니다.
   */
  legacyFallback?: boolean
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
  private composition?: CompositionTracker
  private editingAreaManager?: EditingAreaManager
  private context: EditorContext
  private config: EditorCoreConfig
  private status: AppStatusValue = AppStatus.NOT_READY
  private pendingPlugins: Plugin[] = []
  private focusRequestUnsub?: () => void
  private onErrorUnsub?: () => void
  private commandRegistry: CommandRegistry
  private unregisterModelCommands?: () => void

  /**
   * `EditorCore` 인스턴스를 생성합니다
   *
   * @param config 설정 옵션
   */
  constructor(config: EditorCoreConfig = {}) {
    this.config = config

    if (config.logLevel) {
      setLogLevel(config.logLevel)
    }

    this.eventBus = new EventBus()


    if (config.onError) {
      const { onError } = config
      this.onErrorUnsub = this.eventBus.on(
        CoreEvents.ERROR,
        'on',
        (data?: unknown) => {
          onError(data as EditorErrorData)
        }
      )
    }

    /*
     * 커맨드가 성공하면 편집 영역으로 포커스를 되돌립니다.
     * 툴바 버튼을 누르면 포커스가 그 버튼에 남아, 이어지는 타이핑이
     * 편집 영역에 닿지 않고 사라집니다.
     */
    this.focusRequestUnsub = this.eventBus.on(
      CoreEvents.FOCUS_REQUESTED,
      'on',
      () => {
        this.focus()
      }
    )

    this.context = {
      eventBus: this.eventBus,
      config: this.config,
      element: config.element,
    }

    // 커맨드 레지스트리 생성 + 기본 커맨드(자체 구현 + 선택적 레거시 폴백) 등록.
    // context를 라이브 참조로 보유하므로, 이후 element/selectionManager가
    // 갱신되어도 실행 시점의 최신 값을 사용합니다.
    this.commandRegistry = new CommandRegistry(this.context)
    registerDefaultCommands(this.commandRegistry, {
      legacyFallback: config.legacyFallback,
    })
    this.context.commandRegistry = this.commandRegistry

    /*
     * 모델 커맨드를 **미리** 얹습니다.
     *
     * 아직 편집 영역이 없으므로 `getState()` 는 `null` 이고, 그러면 모델
     * 커맨드는 "처리하지 않았다" 고 답해 아래 층이 지금까지 하던 대로 합니다.
     * 편집 영역이 생겨 상태를 내주기 시작하면 그때부터 모델 쪽이 맡습니다 —
     * 갈아타기가 여기 한 줄에 들어 있습니다.
     *
     * 매번 현재 영역을 다시 묻는 이유는 **모드가 바뀌기 때문**입니다. 소스·텍스트
     * 모드에는 모델이 없어 `null` 이 되고, WYSIWYG 로 돌아오면 다시 잡습니다.
     */
    this.unregisterModelCommands = registerModelCommands(this.commandRegistry, {
      getState: () => this.modelStateHandle()?.getState() ?? null,
      dispatch: (tr) => this.modelStateHandle()?.dispatch(tr),
    })

    if (config.element) {
      this.composition = trackComposition(config.element)
      this.context.composition = this.composition
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
        this.composition = trackComposition(this.context.element)
        this.context.composition = this.composition
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
   * 지금 편집 영역이 자기 문서를 소유하면 그 창구를 돌려줍니다
   */
  private modelStateHandle() {
    return this.editingAreaManager?.getCurrentArea()?.getStateHandle?.()
  }

  /**
   * `CommandRegistry` 인스턴스를 가져옵니다
   */
  getCommandRegistry(): CommandRegistry {
    return this.commandRegistry
  }

  /**
   * IME 조합 상태를 보는 창구를 가져옵니다
   */
  getCompositionTracker(): CompositionTracker | undefined {
    return this.composition
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
   * 지금 문서를 **HTML 로** 가져옵니다.
   *
   * 안쪽 진실은 모델이고 이건 밖으로 내보내는 형식입니다 — 내보내기·소스
   * 보기·붙여넣기가 씁니다. 저장에는 `getJSON()` 을 쓰십시오
   * (`docs/prosemirror-migration.md` §8).
   */
  async getContent(): Promise<string> {
    return toHtml(await this.getDocument(), sagakSchema, document)
  }

  /**
   * HTML 을 넣습니다 — **스키마를 통과합니다.**
   *
   * 스키마 밖의 것은 조용히 정규화되거나 사라집니다. 붙여넣기·초기 콘텐츠처럼
   * 바깥에서 들어오는 HTML 이 지나는 문입니다.
   */
  async setContent(content: string): Promise<void> {
    await this.setDocument(parseHtml(content, sagakSchema, document))
  }

  /**
   * 저장용 — 문서를 **JSON 으로** 가져옵니다.
   *
   * 모델이 곧 저장물이라 왕복 손실이 없습니다. HTML 로 저장하던 때는 문서를
   * 열 때마다 스키마를 통과했습니다.
   */
  async getJSON(): Promise<DocumentJSON> {
    return toJSON(await this.getDocument())
  }

  /**
   * 저장물을 되돌립니다.
   *
   * @throws 스키마에 없는 노드·마크가 들어 있으면. HTML 파싱과 달리 조용히
   * 버리지 않습니다 — **부르는 쪽이 이 오류를 받아 알려야** 합니다.
   */
  async setJSON(json: DocumentJSON): Promise<void> {
    await this.setDocument(fromJSON(json, sagakSchema))
  }

  private async getDocument(): Promise<PMNode> {
    if (!this.editingAreaManager) {
      throw new Error('EditingAreaManager not initialized')
    }

    return await this.editingAreaManager.getContent()
  }

  private async setDocument(doc: PMNode): Promise<void> {
    if (!this.editingAreaManager) {
      throw new Error('EditingAreaManager not initialized')
    }

    await this.editingAreaManager.setContent(doc)
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
   * 애플리케이션을 정리합니다
   * 모든 플러그인과 이벤트 리스너를 정리합니다
   */
  destroy(): void {
    this.onErrorUnsub?.()
    this.onErrorUnsub = undefined
    this.focusRequestUnsub?.()
    this.focusRequestUnsub = undefined
    this.unregisterModelCommands?.()
    this.unregisterModelCommands = undefined

    this.pluginManager.destroyAll()

    if (this.editingAreaManager) {
      this.editingAreaManager.destroy()
      this.editingAreaManager = undefined
    }

    this.eventBus.clearAll()

    this.status = AppStatus.NOT_READY
  }
}
