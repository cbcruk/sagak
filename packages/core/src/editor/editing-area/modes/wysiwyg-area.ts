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
import { history, closeHistory } from 'prosemirror-history'
import { keymap } from 'prosemirror-keymap'
import { baseKeymap } from 'prosemirror-commands'
import { columnResizing } from 'prosemirror-tables'
import {
  splitListItem,
  liftListItem,
  sinkListItem,
} from 'prosemirror-schema-list'
import { logger } from '@/core/logger'
import { createErrorReporter, type ErrorReporter } from '@/core/errors'
import type { EventBus } from '@/core'
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
    /*
     * **열 너비는 `prosemirror-tables` 가 압니다.**
     *
     * 손으로 짠 리사이즈 플러그인이 260줄 있었는데, 그것은 `cell.style.width`
     * 를 DOM 에 직접 썼습니다. 문서 모델을 안 지나므로 **저장되지 않았습니다**
     * — 새로 고치면 너비가 사라졌고 되돌리기도 안 됐습니다. 그런데도 조절이
     * 끝나면 저장을 예약해서, 바뀐 것이 안 담긴 내용을 저장하고 "Saved" 를
     * 보여 줬습니다.
     *
     * `columnResizing` 은 `colwidth` 속성을 트랜잭션으로 씁니다 — 스키마에
     * 원래 있던 자리입니다(`tableNodes` 가 넣어 줍니다). §11-6 에서 단축키를
     * `prosemirror-keymap` 으로 옮긴 것과 같은 갈래입니다.
     */
    columnResizing({ cellMinWidth: 30 }),
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
  private extraPlugins: PMPlugin[] = []
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
  }

  /**
   * WYSIWYG 편집 영역을 숨깁니다
   */
  async hide(): Promise<void> {
    this.element.style.display = 'none'
    this.visible = false
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
  /**
   * **`prosemirror-view` 의 이음매를 그대로 내줍니다.**
   *
   * 예전에는 편집 영역이 DOM 이벤트를 버스로 옮겨 실었습니다 —
   * `WYSIWYG_KEYDOWN`·`KEYUP`·`PASTE`·`BLURRED`. 그런데 PM 은 그 자리를
   * **이미 갖고 있습니다**(`handleKeyDown`·`handlePaste`·`handleDOMEvents`).
   * 그 위에 버스를 얹은 것은 **두 번째 이음매**였고 약한 쪽이었습니다 —
   * 문서 상태를 못 보고, 조합 중에도 불리고, 다른 키맵과의 순서를 모릅니다.
   *
   * 이제 붙는 쪽이 PM 플러그인을 직접 답니다.
   *
   * @returns 떼는 함수
   */
  addPlugin(plugin: PMPlugin): () => void {
    this.extraPlugins.push(plugin)
    this.reconfigure()

    return () => {
      const at = this.extraPlugins.indexOf(plugin)

      if (at < 0) return

      this.extraPlugins.splice(at, 1)
      this.reconfigure()
    }
  }

  /**
   * **붙인 것이 앞에 섭니다.**
   *
   * `prosemirror-view` 는 앞쪽 플러그인의 `handleKeyDown` 을 먼저 부르고,
   * 하나가 `true` 를 돌려주면 거기서 멈춥니다. 뒤에 두면 `baseKeymap` 이
   * 이미 먹은 키는 영영 못 봅니다 — 실제로 **자동 완성의 Enter 확정이 그렇게
   * 죽어 있었습니다.** `splitBlock` 이 문단에서 언제나 `true` 라, 제안이 떠
   * 있어도 Enter 는 줄바꿈이 됐습니다 (Tab 은 목록 밖에서 `sinkListItem` 이
   * `false` 를 돌려줘 우연히 살아 있었습니다).
   *
   * 붙는 쪽이 안 맞는 키를 `false` 로 흘려보내는 것은 그쪽 책임입니다.
   */
  private reconfigure(): void {
    this.view.updateState(
      this.view.state.reconfigure({
        plugins: [...this.extraPlugins, ...editingPlugins()],
      })
    )
  }

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
    /*
     * **강조는 에디터보다 오래 살 수 있습니다.**
     *
     * 찾기가 플러그인이던 때는 에디터가 죽으면 구독도 함께 끊겨서 늦게 온
     * 요청이 갈 곳이 없었습니다. 지금은 부르는 쪽이 객체를 직접 들고 있어서,
     * 다이얼로그의 `close` 처럼 **정리 순서 뒤에 오는 호출**이 실제로
     * 들어옵니다. 그때 뷰에 트랜잭션을 던지면 터집니다.
     */
    if (this.view.isDestroyed) {
      return
    }

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
    if (this.view.isDestroyed) {
      return
    }

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
    const next = EditorState.create({
      doc,
      plugins: [...this.extraPlugins, ...editingPlugins()],
    })

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
    if (event.defaultPrevented) {
      return true
    }

    const items = Array.from(event.clipboardData?.items ?? [])

    /*
     * 이미지 붙여넣기는 업로드 플러그인의 몫입니다.
     *
     * 예전에는 여기서 `WYSIWYG_PASTE` 를 실어 보내 누군가 가로챌 수 있게
     * 했습니다. 그건 PM 의 `handlePaste` 를 버스로 감싼 것이라, 붙는 쪽은
     * `addPlugin` 으로 자기 `handlePaste` 를 다는 편이 낫습니다.
     */
    return items.some((item) => item.type.startsWith('image/'))
  }

  /**
   * 되돌리기 기록을 **여기서 끊습니다.**
   *
   * 스냅샷 히스토리에서는 지금 상태를 통째로 찍어 두는 일(`CAPTURE_SNAPSHOT`)
   * 이었지만, 모델에는 찍을 것이 없습니다 — 바뀐 것은 트랜잭션 자신이 알고
   * 있습니다. 남는 뜻은 **다음 변경을 앞의 것과 한 덩어리로 묶지 말라**이고,
   * 그게 `closeHistory` 입니다.
   *
   * 커맨드 경계가 커맨드를 돌리기 직전에 부릅니다 — 예전에는 버스를 한 바퀴
   * 돌았습니다.
   */
  closeHistoryGroup(): void {
    this.view.dispatch(closeHistory(this.view.state.tr))
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
