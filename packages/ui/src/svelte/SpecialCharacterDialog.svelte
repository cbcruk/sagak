<script lang="ts">
  import { Omega } from 'lucide'
  import { ContentEvents } from 'sagak-core'
  import type { EditorContext } from 'sagak-core'
  import { icon } from '../elements/icon'
  import { categories } from '../components/special-character-dialog/special-character-dialog.shared'

  /**
   * 특수문자 다이얼로그 — **지금까지 옮긴 것 중 상태가 가장 적습니다.**
   *
   * 고른 갈래 번호 하나가 전부입니다. 나머지는 데이터(`categories`)를 그대로
   * 그리는 일이라, 이미지 다이얼로그에서 아홉 개 상태를 엮던 것과 정반대
   * 자리에 있습니다. 그래서 여기서 보이는 것은 **반복 렌더**입니다 —
   * `{#each}` 두 겹으로 탭 줄과 문자 격자를 그립니다.
   *
   * ## 탭은 kinu 를 안 써도 됩니다
   *
   * kinu 의 `TabList`/`Tab` 을 열어 보니 `<div k="tablist">` 와
   * `<button k="tab">` 을 만드는 것이 전부였습니다. 고른 표시는
   * `[k=tab][aria-selected=true]` 규칙이고 미끄러지는 배경까지 **순수 CSS**
   * (`anchor-name`/`position-anchor`)라 자바스크립트가 없습니다.
   *
   * 즉 `aria-selected` 만 제대로 달면 생김새가 그대로 옵니다. `Dialog` 때와
   * 같은 결론입니다 — kinu 가 얹은 것은 마크업과 CSS 지 동작이 아니었습니다.
   *
   * `role="tab"`/`role="tablist"` 은 `svelte-check` 가 알려 줬습니다 —
   * `aria-selected` 는 버튼의 암묵 역할에서는 안 통하는 속성입니다. 검사가
   * 없던 층을 켜자마자 나온 것이라, 옮길 때부터 틀려 있었습니다.
   *
   * ## 목록은 밖에 있습니다
   *
   * `special-character-dialog.shared.ts` 에서 가져옵니다. 문자 목록이 두 판에
   * 복사돼 있으면 한 글자 갈린 것을 검사가 아니라 눈으로 찾아야 합니다.
   */

  interface Props {
    editor: EditorContext | null
    /** 좁은 화면에서 트리거를 감춥니다 — 자세한 이유는 아래 */
    hideTrigger?: boolean
  }

  const { editor, hideTrigger = false }: Props = $props()

  let dialogEl: HTMLDialogElement
  let activeCategory = $state(0)

  export function open(): void {
    editor?.selectionManager?.saveSelection()
    dialogEl.showModal()
  }

  /** 닫은 다음 프레임에 선택을 되돌리고 넣습니다 */
  function insert(character: string): void {
    dialogEl.close()
    requestAnimationFrame(() => {
      editor?.selectionManager?.restoreSelection()
      editor?.eventBus.emit(ContentEvents.SPECIAL_CHARACTER_INSERT, {
        character,
      })
    })
  }
</script>

<button
  type="button"
  data-part="icon-button"
  data-mobile={hideTrigger ? 'hidden' : undefined}
  title="Insert Special Character"
  aria-label="Insert Special Character"
  onclick={open}
>
  {@html icon(Omega, 18).outerHTML}
</button>

<dialog bind:this={dialogEl} k="dialog-content" aria-label="Insert Special Character">
  <h2>Insert Special Character</h2>

  <div k="tablist" role="tablist">
    {#each categories as category, index (category.name)}
      <button
        type="button"
        k="tab"
        role="tab"
        aria-selected={activeCategory === index}
        onclick={() => (activeCategory = index)}
      >
        {category.name}
      </button>
    {/each}
  </div>

  <div
    style="display: grid; grid-template-columns: repeat(10, 1fr); gap: 6px; max-height: 240px; overflow-y: auto"
  >
    {#each categories[activeCategory].characters as char (char)}
      <button
        type="button"
        k="button"
        variant="outline"
        size="icon"
        title={char}
        onclick={() => insert(char)}
      >
        {char}
      </button>
    {/each}
  </div>

  <div style="display: flex; justify-content: flex-end">
    <button type="button" k="button" variant="outline" onclick={() => dialogEl.close()}>
      Cancel
    </button>
  </div>
</dialog>
