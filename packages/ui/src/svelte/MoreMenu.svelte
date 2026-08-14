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
   * ## 열 개 중 일곱이 아직 아무것도 안 합니다
   *
   * 링크·이미지·표·특수문자·찾기·줄 간격·자간은 **빈 항목**입니다. 좁은
   * 화면에서는 이 메뉴가 그 기능들에 닿는 유일한 길인데(툴바에서
   * `mobile-hidden`) 눌러도 메뉴만 닫힙니다.
   *
   * nanotags 로 옮길 때 이렇게 적어 뒀습니다 — "살리려면 다이얼로그들을 열
   * 수단이 필요한데, 그 다이얼로그들이 전부 kinu `Dialog` 라 2단계 관문
   * 뒤의 일입니다."
   *
   * **그 관문은 이제 지났습니다.** 링크·이미지·표·특수문자·찾기 다이얼로그가
   * 전부 Svelte 컴포넌트고, 형제로 나란히 서 있습니다. 다만 여기서 살리는
   * 것은 이주가 아니라 기능 추가라, **이번에도 죽은 채로 옮깁니다** — 이주는
   * 동작을 같게 두는 것이 먼저입니다. `TODO_ITEM` 이 그 표시입니다.
   *
   * ## 바깥 클릭은 컴포넌트에 남습니다
   *
   * 이 메뉴가 떠 있는 동안만 걸려야 하는 배선입니다. 값(열림 여부)은
   * 컴포넌트 것이고 밖으로 낼 이유가 없습니다.
   */

  interface Props {
    editor: EditorContext | null
  }

  const { editor }: Props = $props()

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
  }

  const SECTIONS: { title: string; items: Item[] }[] = [
    {
      title: 'Insert',
      items: [
        { node: Link, label: 'Link', emit: TODO_ITEM },
        { node: Image, label: 'Image', emit: TODO_ITEM },
        { node: Table, label: 'Table', emit: TODO_ITEM },
        {
          node: Minus,
          label: 'Horizontal Rule',
          emit: ContentEvents.HORIZONTAL_RULE_INSERT,
        },
        { node: Type, label: 'Special Character', emit: TODO_ITEM },
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
      items: [{ node: Search, label: 'Find & Replace', emit: TODO_ITEM }],
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
     * 안 이어진 항목도 **메뉴는 닫습니다.** 옮기기 전부터 그랬습니다 —
     * 빈 함수를 부르고 곧바로 닫습니다.
     */
    if (item.emit) editor?.eventBus.emit(item.emit)
    open = false
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
