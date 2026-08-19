import {
  EditorState,
  Plugin as PMPlugin,
  PluginKey,
  TextSelection,
  type Transaction,
} from 'prosemirror-state'
import { EditorView, Decoration, DecorationSet } from 'prosemirror-view'
import {
  DOMParser,
  DOMSerializer,
  type Node as PMNode,
} from 'prosemirror-model'
import { history, undo, redo, closeHistory } from 'prosemirror-history'
import { keymap } from 'prosemirror-keymap'
import { baseKeymap } from 'prosemirror-commands'
import {
  splitListItem,
  liftListItem,
  sinkListItem,
} from 'prosemirror-schema-list'
import { logger } from '@/core/logger'
import { createErrorReporter, type ErrorReporter } from '@/core/errors'
import { CoreEvents, HistoryEvents, WysiwygEvents, type EventBus } from '@/core'
import type { Highlighter, HighlightRange } from '@/core/types'
import { sagakSchema } from '@/model/schema'
import { toHtml, parseHtml } from '@/model/storage'
import type { StateHandle } from '@/model/register'
import type { ModelListener } from '@/model/bridge'
import type { EditingArea, EditingAreaConfig, IRContent } from '../types'

/**
 * WYSIWYG 편집 영역 — **`prosemirror-view` 가 DOM 을 소유합니다.**
 *
 * ## 무엇이 바뀌었나
 *
 * 전에는 `contentEditable` 요소의 `innerHTML` 이 진실이었습니다. 이제 진실은
 * `EditorState` 하나이고 DOM 은 그것을 그린 것입니다. 그래서 이 클래스가 하던
 * 일 중 **여러 개가 통째로 사라집니다.**
 *
 * | 사라진 것 | 대신 |
 * | --- | --- |
 * | `installStoredMarks` | PM 의 `storedMarks` |
 * | 채움용 `<br>` 끼워 넣기 | PM 의 trailing break |
 * | `selectionchange` 리스너 | 트랜잭션의 선택 변화 |
 * | `SelectionManager` 위임 여섯 | `state.selection` |
 * | 붙여넣기 소독 | 스키마 (표현할 수 없는 것은 안 들어옵니다) |
 *
 * ## 소독은 어디로 갔나
 *
 * 소독기(DOMPurify)가 통째로 없어졌습니다. 예전에는 HTML 문자열을 `innerHTML`
 * 에 넣는 경계가 있어 거기서 걸렀지만, 이제 **HTML 이 DOM 으로 바로 가는 길이
 * 없습니다.** 들어오는 모든 것은 스키마를 지나며, 스키마에 없는 것(`<script>`·
 * `onerror`·`javascript:` 주소)은 모델에 존재할 수 없습니다.
 *
 * ## 히스토리
 *
 * `prosemirror-history` 를 여기서 답니다. 되돌리기 단축키는 **안 답니다** —
 * 키보드 플러그인이 이미 `Ctrl+Z` 를 버스의 `UNDO` 로 옮기고 있어 둘 다 달면
 * 한 번 누를 때 두 번 되돌아갑니다. 버스가 유일한 입구입니다.
 */
export interface WysiwygAreaConfig extends EditingAreaConfig {
  /**
   * 이벤트 발행을 위한 `EventBus`
   */
  eventBus?: EventBus
}

/**
 * 화면에만 있는 표시.
 *
 * 데코레이션은 **문서가 아닙니다** — 트랜잭션에 실려 오지만 `doc` 을 안
 * 바꾸고, 직렬화에도 저장물에도 안 나타납니다. 찾기 강조가 그래야 하는
 * 것입니다.
 *
 * 문서가 바뀌면 `map` 이 자리를 따라 옮겨 줍니다. 예전 DOM span 은 글을 한 자
 * 치면 그대로 어긋났습니다.
 */
const highlightKey = new PluginKey<DecorationSet>('sagak-highlight')

function highlightPlugin(): PMPlugin<DecorationSet> {
  return new PMPlugin<DecorationSet>({
    key: highlightKey,
    state: {
      init: () => DecorationSet.empty,
      apply(tr, current) {
        const next = tr.getMeta(highlightKey) as Decoration[] | undefined

        if (next) {
          return DecorationSet.create(tr.doc, next)
        }

        return current.map(tr.mapping, tr.doc)
      },
    },
    props: {
      decorations: (state) => highlightKey.getState(state),
    },
  })
}

/** 편집에 필요한 최소한의 플러그인 */
function editingPlugins() {
  const listItem = sagakSchema.nodes.list_item

  return [
    history(),
    keymap({
      Enter: splitListItem(listItem),
      Tab: sinkListItem(listItem),
      'Shift-Tab': liftListItem(listItem),
    }),
    keymap(baseKeymap),
    highlightPlugin(),
  ]
}

function emptyDocument(): PMNode {
  return sagakSchema.topNodeType.createAndFill()!
}

export class WysiwygArea implements EditingArea {
  private element: HTMLDivElement
  private container: HTMLElement
  private view: EditorView
  private eventBus?: EventBus
  private visible: boolean = false
  private editable: boolean = true
  private spellCheck: boolean
  private className: string
  private reportError: ErrorReporter
  private unsubscribers: Array<() => void> = []
  private listeners = new Set<ModelListener>()
  private savedSelection?: { anchor: number; head: number }

  constructor(config: WysiwygAreaConfig) {
    this.container = config.container
    this.eventBus = config.eventBus
    this.spellCheck = config.spellCheck !== false
    this.className = config.className || 'modern-wysiwyg-area'
    this.reportError = this.eventBus
      ? createErrorReporter(this.eventBus, 'wysiwyg-area')
      : (error, message) => logger.error(message, error)

    this.element = document.createElement('div')

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

    this.container.appendChild(this.element)

    /*
     * `mount` 로 **우리가 만든 요소를 그대로 씁니다.**
     *
     * `new EditorView(container, …)` 로 만들면 PM 이 자식 div 를 하나 더 만들고,
     * 그러면 `getElement()` 가 돌려주는 요소와 실제 편집 표면이 갈립니다.
     */
    this.view = new EditorView(
      { mount: this.element },
      {
        state: EditorState.create({
          doc: emptyDocument(),
          plugins: editingPlugins(),
        }),
        dispatchTransaction: (tr) => this.applyTransaction(tr),
        editable: () => this.editable,
        attributes: () => this.domAttributes(),
        handlePaste: (_view, event) => this.handlePaste(event),
      }
    )

    this.listenToDomEvents()
    this.listenToHistoryEvents()

  }

  /**
   * 지금 문서를 모델로 돌려줍니다 — **직렬화가 없습니다.**
   */
  async getContent(): Promise<IRContent> {
    return this.view.state.doc
  }

  /**
   * 문서를 갈아 끼웁니다.
   *
   * 상태를 새로 만듭니다 — 되돌리기 기록도 같이 비워집니다. 다른 문서를 여는
   * 것이나 모드를 오간 것이라 이전 문서의 되돌리기가 남아 있으면 오히려
   * 위험합니다.
   */
  async setContent(content: IRContent): Promise<void> {
    this.replaceDocument(content)
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
   *
   * PM 이 선택을 상태로 들고 있어 **복원할 것이 없습니다** — 포커스를 잃어도
   * `state.selection` 은 그대로입니다.
   */
  focus(): void {
    this.view.focus()
  }

  /**
   * 편집 가능 여부를 설정합니다
   */
  setEditable(enabled: boolean): void {
    this.editable = enabled
    this.view.setProps({ editable: () => this.editable })
  }

  /**
   * 맞춤법 검사 활성화 여부를 설정합니다
   */
  setSpellCheck(enabled: boolean): void {
    this.spellCheck = enabled
    this.view.setProps({ attributes: () => this.domAttributes() })
  }

  /**
   * 지금 문서를 HTML 로 돌려줍니다.
   *
   * **`innerHTML` 이 아닙니다.** PM 이 그린 DOM 에는 클래스와 표시용 `<br>` 이
   * 섞여 있어 그대로 내보내면 저장물에 편집기 사정이 새어 들어갑니다. 모델을
   * 직렬화하면 밖에 내놓을 수 있는 꼴 하나만 나옵니다.
   */
  getRawContent(): string {
    return toHtml(this.view.state.doc, sagakSchema, document)
  }

  /**
   * HTML 로 문서를 설정합니다 — 스키마를 지나 모델이 됩니다
   */
  setRawContent(content: string): void {
    this.replaceDocument(parseHtml(content, sagakSchema, document))
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
   * 커맨드가 이 영역의 상태를 읽고 고치는 창구입니다.
   *
   * `EditorCore` 가 이것으로 모델 커맨드를 레지스트리에 얹습니다
   * (`src/model/register.ts`). 이 메서드가 있다는 것은 곧 **이 영역이 자기
   * 문서를 소유한다**는 뜻이고, 히스토리 플러그인도 그 신호를 봅니다.
   */
  getStateHandle(): StateHandle {
    return {
      getState: () => this.view.state,
      dispatch: (tr) => this.view.dispatch(tr),
    }
  }

  /**
   * **상태가 바뀔 때마다** 알립니다.
   *
   * 트랜잭션 하나가 곧 "무엇이 바뀌었나" 의 답이므로 거르지 않고 전부
   * 흘려보냅니다. 문서도 선택도 안 바뀌고 `storedMarks` 만 바뀌는 경우가
   * 있는데(캐럿만 둔 채 굵게를 누른 것) 툴바는 그것도 봐야 합니다.
   *
   * 예전에 구독하는 쪽이 들고 있던 가드 셋(IME 조합 중 무시 · 다음 프레임까지
   * 지연 · 선택이 에디터 밖이면 건너뜀)은 **여기 없습니다.** 조합 중에는
   * `prosemirror-view` 가 트랜잭션을 안 만들고, 트랜잭션이 왔다는 것은 이미
   * 확정된 상태라는 뜻이며, 이 상태는 애초에 이 에디터의 것입니다.
   */
  subscribe(listener: ModelListener): () => void {
    this.listeners.add(listener)

    return () => {
      this.listeners.delete(listener)
    }
  }

  /**
   * 문서를 건드리지 않는 표시 — 찾기 강조가 씁니다
   */
  getHighlighter(): Highlighter {
    return {
      set: (ranges) => this.setHighlights(ranges),
      clear: () => this.setHighlights([]),
      scrollTo: (pos) => this.scrollTo(pos),
    }
  }

  private setHighlights(ranges: HighlightRange[]): void {
    const size = this.view.state.doc.content.size
    const decorations = ranges
      .filter((range) => range.from >= 0 && range.to <= size)
      .map((range) =>
        Decoration.inline(range.from, range.to, {
          ...(range.className ? { class: range.className } : {}),
          ...(range.style ? { style: range.style } : {}),
        })
      )

    /*
     * 메타만 실은 트랜잭션입니다 — `docChanged` 도 선택 변화도 없어서
     * 내용 변경 이벤트가 안 나갑니다. 저장이 더러워지지 않습니다.
     */
    this.view.dispatch(this.view.state.tr.setMeta(highlightKey, decorations))
  }

  private scrollTo(pos: number): void {
    if (pos < 0 || pos > this.view.state.doc.content.size) {
      return
    }

    const { node } = this.view.domAtPos(pos)
    const element =
      node.nodeType === Node.ELEMENT_NODE
        ? (node as Element)
        : node.parentElement

    element?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  /**
   * 현재 선택 영역에 HTML을 삽입합니다
   */
  insertHTML(html: string): boolean {
    try {
      const source = document.createElement('div')
      source.innerHTML = html

      const slice = DOMParser.fromSchema(sagakSchema).parseSlice(source)
      this.view.dispatch(this.view.state.tr.replaceSelection(slice))

      return true
    } catch (e) {
      this.reportError(e, 'HTML 삽입 실패:')
      return false
    }
  }

  /**
   * 현재 선택 영역에 텍스트를 삽입합니다
   */
  insertText(text: string): boolean {
    try {
      this.view.dispatch(this.view.state.tr.insertText(text))

      return true
    } catch (e) {
      this.reportError(e, '텍스트 삽입 실패:')
      return false
    }
  }

  /**
   * 네이티브 `execCommand`를 직접 실행합니다 (탈출구)
   *
   * @deprecated 서식은 커맨드 레지스트리(`EditorCore.getCommandRegistry()`)를
   * 통해 실행하세요. PM 이 DOM 을 소유한 뒤로는 이 경로가 **모델을 거치지
   * 않습니다** — DOM 이 바뀐 것을 PM 이 나중에 읽어 모델로 되돌리므로 결과가
   * 스키마에 눌립니다.
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
    const { from, to } = this.view.state.selection

    return this.view.state.doc.textBetween(from, to, '\n')
  }

  /**
   * 선택된 HTML을 가져옵니다
   */
  getSelectedHTML(): string {
    const slice = this.view.state.selection.content()
    const fragment = DOMSerializer.fromSchema(sagakSchema).serializeFragment(
      slice.content,
      { document }
    )
    const holder = document.createElement('div')
    holder.appendChild(fragment)

    return holder.innerHTML
  }

  /**
   * 현재 선택 영역을 저장합니다
   *
   * 대화상자가 포커스를 가져가는 동안 쓰던 것입니다. 이제는 위치 정수 둘이라
   * DOM 이 바뀌어도 가리키는 자리가 유지됩니다.
   */
  saveSelection(): void {
    const { anchor, head } = this.view.state.selection

    this.savedSelection = { anchor, head }
  }

  /**
   * 저장된 선택 영역을 복원합니다
   */
  restoreSelection(): void {
    if (!this.savedSelection) {
      return
    }

    const { doc } = this.view.state
    const limit = doc.content.size

    try {
      this.view.dispatch(
        this.view.state.tr.setSelection(
          TextSelection.create(
            doc,
            Math.min(this.savedSelection.anchor, limit),
            Math.min(this.savedSelection.head, limit)
          )
        )
      )
      this.view.focus()
    } catch (e) {
      this.reportError(e, '선택 영역 복원 실패:')
    }
  }

  /**
   * IME 입력이 진행 중인지 확인합니다
   */
  isComposing(): boolean {
    return this.view.composing
  }

  /**
   * 문서를 통째로 갈아 끼웁니다 — 되돌리기 기록도 새로 시작합니다
   */
  private replaceDocument(doc: PMNode): void {
    const next = EditorState.create({ doc, plugins: editingPlugins() })

    this.view.updateState(next)

    for (const listener of this.listeners) {
      listener(next, null)
    }

  }

  /**
   * **모든 변경이 여기를 지납니다.**
   *
   * 트랜잭션 하나가 곧 "무엇이 바뀌었나" 의 답이라, 예전처럼 DOM 이벤트를
   * 종류별로 듣고 짐작할 필요가 없습니다.
   */
  private applyTransaction(tr: Transaction): void {
    const previous = this.view.state
    const next = previous.apply(tr)

    this.view.updateState(next)

    for (const listener of this.listeners) {
      listener(next, tr)
    }

    if (!this.eventBus) {
      return
    }

    if (tr.docChanged) {
      /*
       * `content` 는 **읽을 때** 직렬화합니다.
       *
       * 구독자 둘 다(`EditorCore` 의 서식 상태 갱신, 자동 저장) 이 값을 읽지
       * 않습니다. 게터로 두면 계약은 그대로이고 아무도 안 읽으면 비용이 0 입니다.
       */
      const read = () => this.getRawContent()

      this.eventBus.emit(WysiwygEvents.WYSIWYG_CONTENT_CHANGED, {
        get content(): string {
          return read()
        },
      })

    }

  }

  private domAttributes(): Record<string, string> {
    return {
      class: this.className,
      spellcheck: this.spellCheck ? 'true' : 'false',
    }
  }

  /**
   * 붙여넣기.
   *
   * PM 이 클립보드를 자기 파서로 읽습니다 — 스키마 밖의 것은 애초에 못
   * 들어오므로 따로 소독하지 않습니다. 이미지만 비켜 줍니다.
   */
  private handlePaste(event: ClipboardEvent): boolean {
    if (this.eventBus) {
      this.eventBus.emit(WysiwygEvents.WYSIWYG_PASTE, { event })
    }

    if (event.defaultPrevented) {
      return true
    }

    const items = Array.from(event.clipboardData?.items ?? [])

    /* 이미지 붙여넣기는 업로드 플러그인의 몫입니다 */
    return items.some((item) => item.type.startsWith('image/'))
  }

  /**
   * DOM 이벤트를 버스로 옮깁니다
   *
   * 내용과 선택은 여기 없습니다 — 트랜잭션에서 나옵니다.
   */
  private listenToDomEvents(): void {
    const forward = (type: string, event: string) => {
      const handler = (e: Event) => {
        this.eventBus?.emit(event, { event: e })
      }

      this.element.addEventListener(type, handler)
      this.unsubscribers.push(() =>
        this.element.removeEventListener(type, handler)
      )
    }

    const announce = (type: string, event: string) => {
      const handler = () => {
        this.eventBus?.emit(event)
      }

      this.element.addEventListener(type, handler)
      this.unsubscribers.push(() =>
        this.element.removeEventListener(type, handler)
      )
    }

    announce('focus', WysiwygEvents.WYSIWYG_FOCUSED)
    announce('blur', WysiwygEvents.WYSIWYG_BLURRED)
    forward('keydown', WysiwygEvents.WYSIWYG_KEYDOWN)
    forward('keyup', WysiwygEvents.WYSIWYG_KEYUP)
  }

  /**
   * 되돌리기·다시 하기는 **버스로 들어옵니다.**
   *
   * 키보드 플러그인이 `Ctrl+Z` 를 여기로 옮기고, 툴바 버튼도 같은 이벤트를
   * 씁니다. 그래서 뷰에는 단축키를 안 답니다 — 입구가 둘이면 한 번에 두 번
   * 되돌아갑니다.
   */
  private listenToHistoryEvents(): void {
    if (!this.eventBus) {
      return
    }

    const bus = this.eventBus
    const run = (command: typeof undo): (() => boolean) => {
      return () => {
        return command(this.view.state, (tr) => this.view.dispatch(tr))
      }
    }

    this.unsubscribers.push(
      bus.on(HistoryEvents.UNDO, 'on', run(undo)),
      bus.on(HistoryEvents.REDO, 'on', run(redo)),

      /*
       * `CAPTURE_SNAPSHOT` 은 **"여기서 끊어라"** 입니다.
       *
       * 스냅샷 히스토리에서는 지금 상태를 통째로 찍어 두는 일이었지만, 모델에는
       * 찍을 것이 없습니다 — 바뀐 것은 트랜잭션 자신이 알고 있습니다. 남는 뜻은
       * **다음 변경을 앞의 것과 한 덩어리로 묶지 말라**이고, 그게 `closeHistory`
       * 입니다.
       */
      bus.on(CoreEvents.CAPTURE_SNAPSHOT, 'on', () => {
        this.view.dispatch(closeHistory(this.view.state.tr))

        return true
      })
    )
  }

  /**
   * 리소스를 정리합니다
   */
  destroy(): void {
    for (const unsubscribe of this.unsubscribers) {
      unsubscribe()
    }
    this.unsubscribers = []
    this.listeners.clear()

    /* `mount` 로 만든 뷰는 요소를 남깁니다 — 치우는 것은 우리 몫입니다 */
    this.view.destroy()

    if (this.element.parentNode) {
      this.element.parentNode.removeChild(this.element)
    }
  }
}
