<script lang="ts">
  import { ListOrdered, List, ChevronDown } from 'lucide'
  import { ParagraphEvents } from 'sagak-core'
  import type { EditorContext } from 'sagak-core'
  import { icon } from '../elements/icon'
  import { subscribeToSelection } from '../state/selection'
  import {
    getCurrentListType,
    type ListType,
  } from '../components/list-buttons/list-buttons.shared'

  /**
   * 목록 버튼 — **드롭다운 메뉴를 처음 옮기는 자리**입니다.
   *
   * 다이얼로그는 다섯 번 옮겼지만 메뉴는 처음입니다. 열어 보니 여기도
   * 네이티브 `<dialog>` 였습니다. 다만 `showModal()` 이 아니라 `show()` —
   * 모달이 아니라서 뒤쪽이 안 막히고 백드롭도 없습니다.
   *
   * ## 위치는 CSS 가 잡습니다
   *
   * kinu 의 드롭다운은 **CSS 앵커 위치잡기**입니다. 감싼 `[k=dropdown]` 안에서
   * `[commandfor]` 가 달린 자식이 `anchor-name: --k-trigger` 를 받고, 메뉴가
   * `position-anchor` 로 그 아래에 붙습니다. 넘칠 때 뒤집는 것까지
   * `position-try-fallbacks` 라 자바스크립트가 없습니다.
   *
   * 그래서 여는 것을 우리가 맡아도 `commandfor` 는 **남겨야 합니다.** 값이
   * 아니라 속성의 존재가 선택자에 걸립니다. 대신 `command` 는 안 답니다 —
   * 그걸 달면 브라우저도 열고 우리도 열어 두 번 열립니다.
   *
   * ## 눌러도 메뉴는 스스로 닫히지 않습니다
   *
   * kinu 는 메뉴 자신에게 `command="close"` 를 달아 두지만, 인보커는 **눌린
   * 요소 자신**에게만 걸리므로 안쪽 버튼을 눌러도 안 닫힙니다. Preact 판이
   * 항목마다 `close()` 를 부르던 이유입니다. 여기서도 같습니다.
   */

  interface Props {
    editor: EditorContext | null
  }

  const { editor }: Props = $props()

  const menuId = $props.id()

  let menuEl: HTMLDialogElement
  let currentList = $state<ListType>('none')

  $effect(() => {
    if (!editor) return
    const sync = (): void => {
      currentList = getCurrentListType()
    }
    sync()
    return subscribeToSelection(editor, sync)
  })

  function choose(event: (typeof ParagraphEvents)[keyof typeof ParagraphEvents]): void {
    menuEl.close()
    editor?.eventBus.emit(event)
  }
</script>

<div k="dropdown">
  <button
    type="button"
    commandfor={menuId}
    data-part="icon-button"
    data-width="auto"
    data-state={currentList !== 'none' ? 'on' : undefined}
    title="List"
    aria-label="List"
    onclick={() => menuEl.show()}
  >
    {@html icon(currentList === 'ordered' ? ListOrdered : List, 16).outerHTML}
    {@html icon(ChevronDown, 12).outerHTML}
  </button>

  <dialog bind:this={menuEl} id={menuId} k="dropdown-content" aria-label="List type">
    <button
      type="button"
      k="dropdown-menu-item"
      selected={currentList === 'unordered'}
      onclick={() => choose(ParagraphEvents.UNORDERED_LIST_CLICKED)}
    >
      Bullet List
    </button>
    <button
      type="button"
      k="dropdown-menu-item"
      selected={currentList === 'ordered'}
      onclick={() => choose(ParagraphEvents.ORDERED_LIST_CLICKED)}
    >
      Numbered List
    </button>
  </dialog>
</div>
