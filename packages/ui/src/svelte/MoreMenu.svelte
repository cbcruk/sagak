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
  import { ChevronRight, ChevronLeft, Check } from 'lucide'
  import type { IconNode } from 'lucide'
  import { ContentEvents, TextStyleEvents } from 'sagak-core'
  import type { EditorContext } from 'sagak-core'
  import { icon } from '../elements/icon'
  import { choiceStore } from '../state/toolbar-choice'
  import { LINE_HEIGHT, LETTER_SPACING } from './toolbar-select.specs'
  import type { ToolbarSelectSpec } from './toolbar-select.specs'

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
   * ## 나머지 둘은 목록을 안으로 들였습니다
   *
   * 줄 간격·자간은 다이얼로그가 아니라 `<select>` 라 "여는" 길이 없습니다
   * (`showPicker()` 는 감춰진 요소에서 던집니다). 그래서 여는 대신 **같은
   * 목록을 메뉴 안에 그립니다** — 항목을 누르면 하위 목록으로 들어가고,
   * 값을 고르면 바로 먹습니다.
   *
   * 목록은 툴바 드롭다운과 **같은 명세**(`toolbar-select.specs`)에서 옵니다.
   * 옮겨 적으면 한 글자 갈린 것을 눈으로 찾아야 하는데, 이 저장소는 이미
   * 그걸로 한 번 데었습니다 (자간 목록을 지어냈다가 셀렉트 폭이 85 → 63px).
   *
   * 고른 값도 명세의 `chosen` 저장소에 같이 둡니다. 안 그러면 메뉴에서 고른
   * 2.0 과 툴바가 가리키는 1.5 가 어긋납니다.
   *
   * ## 선택 영역은 안 건드립니다
   *
   * 툴바 `<select>` 는 `saveSelection`/`restoreSelection` 을 하는데, 그건
   * 네이티브 셀렉트 팝업이 선택을 접기 때문입니다. 버튼은 다릅니다 — 재 보니
   * 트리거에 진짜 포커스를 줘도 편집 영역의 범위가 그대로 남습니다
   * (`rangeCount=1`, anchor 가 편집 영역 안). 이미 이어져 있는 수평선·첨자
   * 항목도 저장 없이 먹고 있고, 같은 이유입니다.
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
    editor: EditorContext
    /** 툴바가 그 다이얼로그를 엽니다 — 좁은 화면에서는 여기가 유일한 길입니다 */
    onOpenDialog?: (which: DialogName) => void
  }

  const { editor, onOpenDialog }: Props = $props()

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
    /** 이벤트 대신 하위 목록으로 들어가는 항목 */
    submenu?: ToolbarSelectSpec
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
        { node: ALargeSmall, label: 'Line Height', submenu: LINE_HEIGHT },
        { node: CaseSensitive, label: 'Letter Spacing', submenu: LETTER_SPACING },
      ],
    },
    {
      title: 'Tools',
      items: [{ node: Search, label: 'Find & Replace', dialog: 'find' }],
    },
  ]

  let container: HTMLDivElement
  let open = $state(false)

  /** 하위 목록을 보고 있는 중이면 그 명세 — 아니면 `null` */
  let submenu = $state<ToolbarSelectSpec | null>(null)

  /** 하위 목록에서 지금 고른 값 (체크 표시용) — 툴바와 같은 칸입니다 */
  let chosen = $state('')

  const store = $derived(
    submenu?.initialValue === undefined
      ? null
      : choiceStore(editor, submenu.title, submenu.initialValue)
  )

  $effect(() => {
    if (!store) return
    return store.subscribe((next) => (chosen = next))
  })

  function close(): void {
    open = false
    /* 다음에 열 때 하위 목록에 갇혀 있지 않도록 되돌립니다 */
    submenu = null
  }

  $effect(() => {
    if (!open) return
    const onMouseDown = (event: MouseEvent): void => {
      if (container.contains(event.target as Node)) return
      close()
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  })

  function run(item: Item): void {
    /* 하위 목록은 **닫지 않고** 안으로 들어갑니다 */
    if (item.submenu) {
      submenu = item.submenu
      return
    }
    /*
     * 메뉴를 **먼저** 닫습니다. 다이얼로그를 열고 나서 닫으면 그 사이에
     * 바깥 클릭 리스너가 살아 있어, 다이얼로그 안을 누르는 것이 "바깥" 으로
     * 잡힙니다.
     */
    close()
    if (item.emit) editor.eventBus.emit(item.emit)
    if (item.dialog) onOpenDialog?.(item.dialog)
  }

  function pick(spec: ToolbarSelectSpec, value: string): void {
    /* 칸은 닫기 **전에** 씁니다 — 닫으면 `submenu` 가 풀려 `store` 도 없어집니다 */
    store?.set(value)
    close()
    if (editor) spec.apply(editor, value)
  }
</script>

<div bind:this={container} style="position: relative">
  <button
    type="button"
    data-scope="more-menu"
    data-part="trigger"
    title="More options"
    onclick={() => (open ? close() : (open = true))}
  >
    {@html icon(Ellipsis, 16).outerHTML}
  </button>

  {#if open}
    <div data-scope="more-menu" data-part="menu">
      {#if submenu}
        <div data-scope="more-menu" data-part="section">
          <button
            type="button"
            data-scope="more-menu"
            data-part="item"
            data-role="back"
            onclick={() => (submenu = null)}
          >
            {@html icon(ChevronLeft, 16).outerHTML}
            <span>{submenu.title}</span>
          </button>
        </div>
        <div data-scope="more-menu" data-part="section">
          {#each submenu.options as option (option.value)}
            {@const spec = submenu}
            <button
              type="button"
              data-scope="more-menu"
              data-part="item"
              role="menuitemradio"
              aria-checked={chosen === option.value}
              data-state-active={chosen === option.value ? '' : undefined}
              onclick={() => pick(spec, option.value)}
            >
              <!--
                체크는 있을 때만 그리되 **자리는 늘 잡아 둡니다.** 안 그러면
                고른 줄만 라벨이 왼쪽으로 밀려 목록이 들쭉날쭉해집니다.
              -->
              <span
                data-part="check"
                style="display: inline-flex; width: 16px; flex: none"
              >
                {#if chosen === option.value}
                  {@html icon(Check, 16).outerHTML}
                {/if}
              </span>
              <span>{option.label}</span>
            </button>
          {/each}
        </div>
      {:else}
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
                aria-haspopup={item.submenu ? 'menu' : undefined}
                onclick={() => run(item)}
              >
                {@html icon(item.node, 16).outerHTML}
                <span>{item.label}</span>
                {#if item.submenu}
                  <span data-part="chevron" style="margin-left: auto">
                    {@html icon(ChevronRight, 14).outerHTML}
                  </span>
                {/if}
              </button>
            {/each}
          </div>
        {/each}
      {/if}
    </div>
  {/if}
</div>
