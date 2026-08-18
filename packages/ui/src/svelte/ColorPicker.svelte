<script lang="ts">
  import { X } from 'lucide'
  import { FontEvents } from 'sagak-core'
  import type { EditorContext } from 'sagak-core'
  import { icon } from '../elements/icon'
  import {
    PRESET_COLORS,
    addRecentColor,
    loadRecentColors,
    type ColorType,
  } from '../components/color-picker/color-picker.shared'

  /**
   * 색 고르개 — 글자색과 형광펜이 **같은 컴포넌트**입니다.
   *
   * 커스텀 엘리먼트 시절에는 `type` 속성을 읽어 갈랐습니다. 속성으로는
   * 문자열밖에 못 넘기니 그럴 수밖에 없었는데, 여기서는 그냥 prop 입니다.
   *
   * ## 최근 색상은 열 때마다 다시 읽습니다
   *
   * 두 고르개가 각각 `localStorage` 를 원천으로 봅니다. 열려 있는 동안
   * 바뀔 일이 없으니 열 때 한 번 읽으면 충분하고, 그래서 상태로 안 들고
   * 있습니다.
   *
   * ## 바깥 클릭은 컴포넌트에 남습니다
   *
   * 이 팝오버가 떠 있는 동안만 걸려야 하는 배선입니다. 폰트 목록·문서
   * 상태처럼 밖으로 올릴 사실이 아닙니다.
   */

  interface Props {
    editor: EditorContext
    type?: ColorType
  }

  const { editor, type = 'text' }: Props = $props()

  const isText = $derived(type === 'text')
  const label = $derived(isText ? 'Text Color' : 'Highlight Color')
  const event = $derived(
    isText ? FontEvents.TEXT_COLOR_CHANGED : FontEvents.BACKGROUND_COLOR_CHANGED
  )

  let container: HTMLDivElement
  let open = $state(false)
  let current = $state(type === 'text' ? '#000000' : '#ffff00')
  let recent = $state<string[]>([])

  $effect(() => {
    if (!open) return
    const onMouseDown = (e: MouseEvent): void => {
      if (container.contains(e.target as Node)) return
      open = false
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  })

  function toggle(): void {
    if (open) {
      open = false
      return
    }
    /* 그 사이 다른 고르개가 색을 더했을 수 있습니다 */
    recent = loadRecentColors(type)
    open = true
  }

  function pick(color: string): void {
    current = color
    open = false
    addRecentColor(type, color)
    editor.eventBus.emit(event, { color })
  }

  function remove(): void {
    open = false
    editor.eventBus.emit(event, { color: isText ? '#000000' : 'transparent' })
    current = isText ? '#000000' : '#ffff00'
  }

  const SWATCH_STYLE =
    'width: 18px; height: 18px; border: 1px solid var(--sagak-chrome-border); border-radius: 2px; cursor: pointer'
  const GRID_STYLE =
    'display: grid; grid-template-columns: repeat(10, 1fr); gap: 2px'
</script>

<div bind:this={container} style="position: relative">
  <button
    type="button"
    data-part="icon-button"
    title={label}
    aria-label={label}
    onclick={toggle}
  >
    <!--
      글자색은 고른 색을 그대로 칠하고 테두리를 뺍니다 — 흰색일 때만 테두리를
      남겨야 안 사라집니다.
    -->
    <span
      style="width: 16px; height: 16px; border-radius: 2px; background: {current}; border: {isText &&
      current !== '#ffffff'
        ? 'none'
        : '1px solid var(--sagak-chrome-border)'}"
    ></span>
  </button>

  {#if open}
    <div
      style="position: absolute; top: 100%; left: 0; margin-top: 4px; padding: 8px; background: var(--sagak-chrome-bg); border: 1px solid var(--sagak-chrome-border); border-radius: 6px; box-shadow: 0 2px 8px var(--sagak-shadow); z-index: 1000; width: 220px"
    >
      <div style="margin-bottom: 8px; font-size: 12px; color: var(--sagak-chrome-muted-fg)">
        {label}
      </div>

      {#if recent.length > 0}
        <div style="margin-bottom: 4px; font-size: 11px; color: var(--sagak-chrome-muted-fg)">
          Recent
        </div>
        <div style="{GRID_STYLE}; margin-bottom: 8px">
          {#each recent as color (color)}
            <button
              type="button"
              title={color}
              style="{SWATCH_STYLE}; background: {color}"
              onclick={() => pick(color)}
              aria-label={color}
            ></button>
          {/each}
        </div>
      {/if}

      <div style={GRID_STYLE}>
        {#each PRESET_COLORS as color (color)}
          <button
            type="button"
            title={color}
            style="{SWATCH_STYLE}; background: {color}"
            onclick={() => pick(color)}
            aria-label={color}
          ></button>
        {/each}
      </div>

      {#if !isText}
        <button
          type="button"
          style="display: flex; align-items: center; gap: 6px; width: 100%; margin-top: 8px; padding: 6px 8px; border: 1px solid var(--sagak-chrome-border); border-radius: 4px; background: var(--sagak-chrome-bg); color: var(--sagak-chrome-fg); cursor: pointer; font-size: 12px"
          onclick={remove}
        >
          {@html icon(X, 12).outerHTML}
          Remove Highlight
        </button>
      {/if}
    </div>
  {/if}
</div>
