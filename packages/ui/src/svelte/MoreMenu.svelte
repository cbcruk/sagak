<script lang="ts">
  import {
    Ellipsis,
    Link,
    Image,
    Table,
    Minus,
    Type,
    Search,
    Subscript,
    Superscript,
    ALargeSmall,
    CaseSensitive,
  } from 'lucide'
  import type { IconNode } from 'lucide'
  import { ContentEvents, TextStyleEvents } from 'sagak-core'
  import type { EditorContext } from 'sagak-core'
  import { icon } from '../elements/icon'

  /**
   * 좁은 화면에서 감춰진 기능들로 가는 메뉴.
   *
   * ## 다섯을 이었습니다
   *
   * 링크·이미지·표·특수문자·찾기가 오래 **빈 항목**이었습니다. 좁은 화면에서는
   * 이 메뉴가 그 기능들에 닿는 유일한 길인데 눌러도 메뉴만 닫혔습니다.
   * 다이얼로그들이 전부 kinu `Dialog` 라 열 수단이 없다는 것이 이유였고,
   * Svelte 로 옮기며 그 이유가 없어졌습니다.
   *
   * 여는 것은 **툴바가** 합니다. 다이얼로그는 툴바가 그리므로 여기서 직접
   * 붙들 수 없고, `onOpenDialog` 로 이름만 올려 보냅니다.
   *
   * ## 줄 간격·자간 둘은 아직 빈 항목입니다
   *
   * 이 둘은 다이얼로그가 아니라 `<select>` 입니다. 여는 API 가 마땅치 않고
   * (`showPicker()` 는 감춰진 요소에서 던집니다), 메뉴 안에 목록을 그리는
   * 것은 이 메뉴에 없던 갈래를 새로 들이는 일입니다. `TODO_ITEM` 으로
   * 남겨 둡니다.
   *
   * ## 바깥 클릭은 컴포넌트에 남습니다
   *
   * 이 메뉴가 떠 있는 동안만 걸려야 하는 배선입니다. 값(열림 여부)은
   * 컴포넌트 것이고 밖으로 낼 이유가 없습니다.
   */

  /** 더보기 메뉴가 열 수 있는 다이얼로그 */
  export type DialogName =
    | 'link'
    | 'image'
    | 'table'
    | 'special-character'
    | 'find'

  interface Props {
    editor: EditorContext | null
    /** 툴바가 그 다이얼로그를 엽니다 — 좁은 화면에서는 여기가 유일한 길입니다 */
    onOpenDialog?: (which: DialogName) => void
  }

  const { editor, onOpenDialog }: Props = $props()

  /** 아직 안 이어진 항목 — 누르면 메뉴만 닫힙니다 */
  const TODO_ITEM = undefined

  /**
   * 쏘는 이벤트를 **실제로 있는 셋으로 좁혀** 둡니다.
   *
   * `string` 으로 두면 오타가 통과하고, 발행할 때 `as never` 같은 캐스팅이
   * 필요해집니다 — 이벤트 맵의 타입 검사를 스스로 꺼 버리는 셈입니다.
   */
  type MenuEvent =
    | typeof ContentEvents.HORIZONTAL_RULE_INSERT
    | typeof TextStyleEvents.TOGGLE_SUBSCRIPT
    | typeof TextStyleEvents.TOGGLE_SUPERSCRIPT

  interface Item {
    node: IconNode
    label: string
    emit?: MenuEvent
    /** 이벤트 대신 다이얼로그를 여는 항목 */
    dialog?: DialogName
  }

  const SECTIONS: { title: string; items: Item[] }[] = [
    {
      title: 'Insert',
      items: [
        { node: Link, label: 'Link', dialog: 'link' },
        { node: Image, label: 'Image', dialog: 'image' },
        { node: Table, label: 'Table', dialog: 'table' },
        {
          node: Minus,
          label: 'Horizontal Rule',
          emit: ContentEvents.HORIZONTAL_RULE_INSERT,
        },
        { node: Type, label: 'Special Character', dialog: 'special-character' },
      ],
    },
    {
      title: 'Text Style',
      items: [
        {
          node: Subscript,
          label: 'Subscript',
          emit: TextStyleEvents.TOGGLE_SUBSCRIPT,
        },
        {
          node: Superscript,
          label: 'Superscript',
          emit: TextStyleEvents.TOGGLE_SUPERSCRIPT,
        },
      ],
    },
    {
      title: 'Format',
      items: [
        { node: ALargeSmall, label: 'Line Height', emit: TODO_ITEM },
        { node: CaseSensitive, label: 'Letter Spacing', emit: TODO_ITEM },
      ],
    },
    {
      title: 'Tools',
      items: [{ node: Search, label: 'Find & Replace', dialog: 'find' }],
    },
  ]

  let container: HTMLDivElement
  let open = $state(false)

  $effect(() => {
    if (!open) return
    const onMouseDown = (event: MouseEvent): void => {
      if (container.contains(event.target as Node)) return
      open = false
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  })

  function run(item: Item): void {
    /*
     * 메뉴를 **먼저** 닫습니다. 다이얼로그를 열고 나서 닫으면 그 사이에
     * 바깥 클릭 리스너가 살아 있어, 다이얼로그 안을 누르는 것이 "바깥" 으로
     * 잡힙니다.
     */
    open = false
    if (item.emit) editor?.eventBus.emit(item.emit)
    if (item.dialog) onOpenDialog?.(item.dialog)
  }
</script>

<div bind:this={container} style="position: relative">
  <button
    type="button"
    data-scope="more-menu"
    data-part="trigger"
    title="More options"
    onclick={() => (open = !open)}
  >
    {@html icon(Ellipsis, 16).outerHTML}
  </button>

  {#if open}
    <div data-scope="more-menu" data-part="menu">
      {#each SECTIONS as section (section.title)}
        <div data-scope="more-menu" data-part="section">
          <div data-scope="more-menu" data-part="section-title">
            {section.title}
          </div>
          {#each section.items as item (item.label)}
            <button
              type="button"
              data-scope="more-menu"
              data-part="item"
              onclick={() => run(item)}
            >
              {@html icon(item.node, 16).outerHTML}
              <span>{item.label}</span>
            </button>
          {/each}
        </div>
      {/each}
    </div>
  {/if}
</div>
