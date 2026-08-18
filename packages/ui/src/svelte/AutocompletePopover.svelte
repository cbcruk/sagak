<script lang="ts">
  import { AutocompleteEvents } from 'sagak-core'
  import type { EditorContext } from 'sagak-core'

  /**
   * 자동 완성 팝오버 — **마지막으로 남은 Preact 컴포넌트**였습니다.
   *
   * 툴바 안이 아니라 편집 영역 위에 떠야 해서 앱이 직접 붙입니다. 그래서
   * 툴바를 다 옮기고도 혼자 남아 있었습니다.
   *
   * ## 네 이벤트를 듣습니다
   *
   * 보이기 · 숨기기 · 위아래 이동 · 확정. 상태는 코어가 정하고 여기는
   * 그리기만 합니다 — 어떤 단어를 제안할지, 어디에 띄울지는 플러그인이
   * 페이로드에 실어 보냅니다.
   *
   * ## 확정에는 갈래가 둘입니다
   *
   * 마우스로 고르면 그 단어를 실어 발행합니다. 키보드로 확정하면 페이로드가
   * 비어 오는데, 그때는 **지금 고른 것**을 실어 다시 발행합니다. 페이로드가
   * 이미 있으면 그건 우리가 보낸 것이므로 흘려보냅니다 — 안 그러면 무한히
   * 되돌아옵니다.
   */

  interface Props {
    editor: EditorContext
  }

  const { editor }: Props = $props()

  let visible = $state(false)
  let suggestions = $state<string[]>([])
  let prefix = $state('')
  let position = $state({ x: 0, y: 0 })
  let selectedIndex = $state(0)

  $effect(() => {
    const bus = editor.eventBus

    const offShow = bus.on(
      AutocompleteEvents.AUTOCOMPLETE_SHOW,
      'on',
      (payload?: unknown) => {
        const data = payload as {
          suggestions: string[]
          prefix: string
          position: { x: number; y: number }
        }
        visible = true
        suggestions = data.suggestions
        prefix = data.prefix
        position = data.position
        selectedIndex = 0
      }
    )

    const offHide = bus.on(AutocompleteEvents.AUTOCOMPLETE_HIDE, 'on', () => {
      visible = false
      suggestions = []
      selectedIndex = 0
    })

    const offSelect = bus.on(
      AutocompleteEvents.AUTOCOMPLETE_SELECT,
      'on',
      (payload?: unknown) => {
        if (!payload || !(payload as object).hasOwnProperty('direction')) return
        if (!visible || suggestions.length === 0) return

        const { direction } = payload as { direction: 'next' | 'previous' }
        const last = suggestions.length - 1
        selectedIndex =
          direction === 'next'
            ? (selectedIndex + 1) % suggestions.length
            : selectedIndex === 0
              ? last
              : selectedIndex - 1
      }
    )

    const offApply = bus.on(
      AutocompleteEvents.AUTOCOMPLETE_APPLY,
      'on',
      (payload?: unknown) => {
        /* 페이로드가 있으면 이미 적용된 것이라 흘려보냅니다 */
        if (payload && (payload as object).hasOwnProperty('word')) return
        if (!visible || suggestions.length === 0) return

        bus.emit(AutocompleteEvents.AUTOCOMPLETE_APPLY, {
          word: suggestions[selectedIndex],
        })
      }
    )

    return () => {
      offShow()
      offHide()
      offSelect()
      offApply()
    }
  })

  function apply(word: string): void {
    editor.eventBus.emit(AutocompleteEvents.AUTOCOMPLETE_APPLY, { word })
  }
</script>

{#if visible && suggestions.length > 0}
  <div
    data-scope="autocomplete"
    data-part="popover"
    style="position: fixed; left: {position.x}px; top: {position.y}px; z-index: 1000"
  >
    <ul data-scope="autocomplete" data-part="list">
      {#each suggestions as word, index (word)}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
        <li
          data-scope="autocomplete"
          data-part="item"
          data-selected={index === selectedIndex ? 'true' : undefined}
          onmousedown={(e) => {
            e.preventDefault()
            apply(word)
          }}
          onmouseenter={() => (selectedIndex = index)}
        >
          <span data-scope="autocomplete" data-part="prefix">{prefix}</span>
          <span data-scope="autocomplete" data-part="completion"
            >{word.slice(prefix.length)}</span
          >
        </li>
      {/each}
    </ul>
  </div>
{/if}
