<script lang="ts">
  import { autocomplete } from 'sagak-core'
  import type { EditorContext, AutocompleteState } from 'sagak-core'

  /**
   * 자동 완성 팝오버 — **그리기만 합니다.**
   *
   * 툴바 안이 아니라 편집 영역 위에 떠야 해서 앱이 직접 붙입니다.
   *
   * ## 넷을 듣던 것이 하나가 됐습니다
   *
   * 예전에는 보이기·숨기기·이동·확정 네 이벤트를 구독했고, **몇 번째가
   * 강조되어 있는가를 여기가 들고 있었습니다.** 그래서 키보드로 확정할 때
   * 코어가 "지금 고른 것이 무엇이냐" 를 물으러 와야 했습니다 — 빈
   * `AUTOCOMPLETE_APPLY` 를 쏘면 여기가 단어를 실어 **같은 이름으로 되쏘는**
   * 왕복이었고, 자기가 보낸 것을 자기가 다시 받는 것을 막는 가드가 딸려
   * 있었습니다.
   *
   * 목록의 주인이 코어이므로 번호의 주인도 코어입니다. 여기 남은 상태는
   * `state` 하나뿐이고, 그것도 코어가 준 것을 그대로 그립니다.
   */

  interface Props {
    editor: EditorContext
  }

  const { editor }: Props = $props()

  let state = $state<AutocompleteState | null>(null)

  $effect(() => autocomplete(editor).subscribe((next) => (state = next)))
</script>

{#if state && state.suggestions.length > 0}
  <div
    data-scope="autocomplete"
    data-part="popover"
    style="position: fixed; left: {state.position.x}px; top: {state.position
      .y}px; z-index: 1000"
  >
    <ul data-scope="autocomplete" data-part="list">
      {#each state.suggestions as word, index (word)}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
        <li
          data-scope="autocomplete"
          data-part="item"
          data-selected={index === state.index ? 'true' : undefined}
          onmousedown={(e) => {
            e.preventDefault()
            autocomplete(editor).apply(index)
          }}
          onmouseenter={() => autocomplete(editor).highlight(index)}
        >
          <span data-scope="autocomplete" data-part="prefix">{state.prefix}</span
          >
          <span data-scope="autocomplete" data-part="completion"
            >{word.slice(state.prefix.length)}</span
          >
        </li>
      {/each}
    </ul>
  </div>
{/if}
