import { define } from 'nanotags'
import {
  TextAlignStart,
  TextAlignCenter,
  TextAlignEnd,
  TextAlignJustify,
  Undo2,
  Redo2,
} from 'lucide'
import { ParagraphEvents, HistoryEvents } from 'sagak-core'
import type { EditorContext } from 'sagak-core'
import { editorContextKey } from './editor-context'
import { icon, toolbarButton } from './icon'
import { subscribeToSelection } from '../hooks/use-selection-derived'
import {
  getCurrentAlignment,
  type AlignmentType,
} from '../components/alignment-buttons/alignment-buttons.shared'

/**
 * **상태를 따라가는** 툴바 버튼들 — 1단계에서 아직 안 지나간 갈래입니다.
 *
 * 앞서 옮긴 것들은 누르면 이벤트만 쏘거나(수평선), 값 하나만 따라갔습니다
 * (드롭다운). 여기는 버튼이 **켜지고 꺼집니다**.
 *
 * 상태의 출처가 둘로 갈립니다.
 *
 * | | 출처 | 구독 |
 * | --- | --- | --- |
 * | 정렬 | 선택 영역의 계산된 `text-align` | `subscribeToSelection` |
 * | 실행 취소/다시 실행 | `HISTORY_STATE_CHANGED` 이벤트 | `eventBus.on` |
 *
 * 둘 다 **원래부터 렌더러와 무관했습니다.** 정렬은 `getCurrentAlignment` 라는
 * 순수 함수였고, 히스토리는 Preact 훅이 이벤트를 감싸고 있었을 뿐입니다
 * (`useHistorySignals` → `useStore(HISTORY_STATE_CHANGED)`). 그래서 여기서도
 * 가드나 상태 계산을 새로 쓰지 않았습니다.
 *
 * ## 아이콘 이름이 또 달랐습니다
 *
 * `lucide-preact` 의 `AlignLeft`·`AlignCenter`·`AlignRight`·`AlignJustify` 는
 * `lucide` 에서 `TextAlignStart`·`TextAlignCenter`·`TextAlignEnd`·
 * `TextAlignJustify` 입니다. 들여쓰기 아이콘에 이어 두 번째라, 이건 예외가
 * 아니라 **규칙으로 봐야 합니다** — 옮길 때마다 이름을 확인해야 합니다.
 */

const ICON_SIZE = 16

export const ALIGNMENT_BUTTONS_TAG = 'sagak-alignment-buttons'
export const HISTORY_BUTTONS_TAG = 'sagak-history-buttons'

/** `data-part="icon-button-group"` 로 묶는 것은 Preact 판과 같은 DOM 입니다 */
function buttonGroup(label: string): HTMLDivElement {
  const group = document.createElement('div')
  group.dataset.part = 'icon-button-group'
  group.role = 'group'
  group.setAttribute('aria-label', label)
  return group
}

const ALIGNMENTS = [
  { value: 'left', label: 'Align Left', node: TextAlignStart },
  { value: 'center', label: 'Align Center', node: TextAlignCenter },
  { value: 'right', label: 'Align Right', node: TextAlignEnd },
  { value: 'justify', label: 'Justify', node: TextAlignJustify },
] as const

define(ALIGNMENT_BUTTONS_TAG, (ctx) => {
  ctx.host.style.display = 'contents'

  const group = buttonGroup('Alignment')
  const buttons = ALIGNMENTS.map(({ value, label, node }) => {
    const button = toolbarButton({ title: label }, icon(node, ICON_SIZE))
    group.append(button)
    return { value, button }
  })
  ctx.host.append(group)

  /**
   * 켜진 것 하나만 `data-state="active"` 입니다. Preact 판이 `state` prop 으로
   * 하던 것과 같은 속성이라 `[data-part='icon-button'][data-state]` 스타일이
   * 그대로 걸립니다.
   *
   * **같은 값이면 안 씁니다.** 예전에는 캐럿이 움직일 때마다 켜진 버튼에
   * `active` 를 다시 써 넣었습니다 — 값이 그대로여도 DOM 변경으로 잡히고,
   * 화면 열 번 갱신에 열 번 다 일어났습니다. `render.browser.test.tsx` 를
   * Preact 렌더 세기에서 DOM 변경 세기로 바꾸고 나서야 보였습니다.
   */
  function paint(current: AlignmentType): void {
    for (const { value, button } of buttons) {
      const next = value === current ? 'active' : undefined
      if (button.dataset.state === next) continue
      if (next) button.dataset.state = next
      else delete button.dataset.state
    }
  }

  editorContextKey.consume(ctx, ($editor) => {
    ctx.effect($editor, (editor) => {
      if (!editor) return

      for (const { value, button } of buttons) {
        ctx.on(button, 'click', () => {
          editor.eventBus.emit(ParagraphEvents.ALIGNMENT_CHANGED, {
            align: value,
          })
        })
      }

      const sync = (): void => paint(getCurrentAlignment())
      sync()
      ctx.onCleanup(subscribeToSelection(editor, sync))
    })
  })

  paint('left')
})

interface HistoryState {
  canUndo: boolean
  canRedo: boolean
}

define(HISTORY_BUTTONS_TAG, (ctx) => {
  ctx.host.style.display = 'contents'

  const group = buttonGroup('History')
  const undo = toolbarButton(
    { title: 'Undo (⌘Z)', label: 'Undo' },
    icon(Undo2, ICON_SIZE)
  )
  const redo = toolbarButton(
    { title: 'Redo (⌘⇧Z)', label: 'Redo' },
    icon(Redo2, ICON_SIZE)
  )
  group.append(undo, redo)
  ctx.host.append(group)

  /*
   * 처음에는 둘 다 눌리지 않습니다 — 되돌릴 것이 아직 없습니다. Preact 판의
   * 초기값(`canUndo: false, canRedo: false`)과 같습니다.
   */
  undo.disabled = true
  redo.disabled = true

  editorContextKey.consume(ctx, ($editor) => {
    ctx.effect($editor, (editor: EditorContext | null) => {
      if (!editor) return

      ctx.on(undo, 'click', () => {
        editor.eventBus.emit(HistoryEvents.UNDO)
      })
      ctx.on(redo, 'click', () => {
        editor.eventBus.emit(HistoryEvents.REDO)
      })

      /*
       * 히스토리 상태는 코어가 발행합니다. Preact 훅이 이 이벤트를 시그널로
       * 감싸고 있었을 뿐이라, 여기서는 직접 듣습니다.
       */
      ctx.onCleanup(
        editor.eventBus.on(
          HistoryEvents.HISTORY_STATE_CHANGED,
          'after',
          (state?: unknown) => {
            const { canUndo, canRedo } = (state ?? {}) as Partial<HistoryState>
            undo.disabled = !canUndo
            redo.disabled = !canRedo
          }
        )
      )
    })
  })
})
