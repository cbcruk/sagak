<script lang="ts">
  import {
    TextAlignStart,
    TextAlignCenter,
    TextAlignEnd,
    TextAlignJustify,
  } from 'lucide'
  import { ParagraphEvents } from 'sagak-core'
  import type { EditorContext } from 'sagak-core'
  import { icon } from '../elements/icon'
  import { subscribeToSelection } from '../hooks/use-selection-derived'
  import { getCurrentAlignment } from '../components/alignment-buttons/alignment-buttons.shared'

  /**
   * 정렬 버튼 넷 — 켜진 것 하나만 `data-state="active"` 입니다.
   *
   * ## 값이 안 바뀌면 안 씁니다
   *
   * nanotags 판에서는 캐럿이 움직일 때마다 켜진 버튼에 `active` 를 **다시 써
   * 넣었습니다.** 값이 그대로여도 DOM 변경으로 잡히고, 화면 열 번 갱신에 열 번
   * 다 일어났습니다. 손으로 쓰던 것을 `$state` 로 바꾸면서 그 헛쓰기가
   * 구조적으로 없어집니다 — Svelte 가 바뀐 값만 반영합니다.
   *
   * `render.browser.test.ts` 가 그 헛쓰기를 처음 잡았고, 지금은 이 파일이
   * 그 검사를 지나갑니다.
   *
   * ## 이름이 또 달랐습니다
   *
   * `lucide-preact` 의 `AlignLeft`·`AlignCenter`·`AlignRight`·`AlignJustify` 가
   * `lucide` 에서는 `TextAlignStart`·`TextAlignCenter`·`TextAlignEnd`·
   * `TextAlignJustify` 입니다. 들여쓰기 아이콘에 이어 두 번째라 예외가 아니라
   * 규칙으로 봅니다.
   */

  interface Props {
    editor: EditorContext | null
  }

  const { editor }: Props = $props()

  const ALIGNMENTS = [
    { value: 'left', label: 'Align Left', node: TextAlignStart },
    { value: 'center', label: 'Align Center', node: TextAlignCenter },
    { value: 'right', label: 'Align Right', node: TextAlignEnd },
    { value: 'justify', label: 'Justify', node: TextAlignJustify },
  ] as const

  let current = $state(getCurrentAlignment())

  $effect(() => {
    if (!editor) return
    const sync = (): void => {
      current = getCurrentAlignment()
    }
    sync()
    return subscribeToSelection(editor, sync)
  })
</script>

<div data-part="icon-button-group" role="group" aria-label="Alignment">
  {#each ALIGNMENTS as item (item.value)}
    <button
      type="button"
      data-part="icon-button"
      data-state={current === item.value ? 'active' : undefined}
      title={item.label}
      aria-label={item.label}
      onclick={() =>
        editor?.eventBus.emit(ParagraphEvents.ALIGNMENT_CHANGED, {
          align: item.value,
        })}
    >
      {@html icon(item.node, 16).outerHTML}
    </button>
  {/each}
</div>
