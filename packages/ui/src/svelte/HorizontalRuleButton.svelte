<script lang="ts">
  import { Minus } from 'lucide'
  import { ContentEvents } from 'sagak-core'
  import type { EditorContext } from 'sagak-core'
  import { icon } from '../elements/icon'

  /**
   * Svelte 로 옮긴 **첫 컴포넌트**입니다.
   *
   * 가장 작은 것(수평선 버튼)을 골랐습니다 — 여기서 재는 것은 이 버튼이
   * 아니라 **툴체인이 물리는가**이기 때문입니다. 컴포넌트가 복잡하면 실패했을
   * 때 원인이 툴체인인지 코드인지 갈리지 않습니다.
   *
   * 관문은 이미 있습니다: `migrated-elements.browser.test.tsx` 의
   * "수평선 버튼이 실제로 수평선을 넣습니다".
   *
   * ## nanotags 판과 무엇이 다른가
   *
   * nanotags 에서는 `document.createElement` 로 버튼을 만들고 `ctx.on` 으로
   * 이벤트를 걸었습니다. 여기서는 **마크업이 마크업으로 보입니다.** 지금은
   * 차이가 작지만, 상태가 아홉 개인 이미지 다이얼로그에서는 이 차이가
   * `paint()` 를 손으로 엮느냐 마느냐가 됩니다.
   *
   * ## 아이콘은 그대로 씁니다
   *
   * `icon()` 은 lucide 데이터로 SVG 요소를 만드는 순수 함수라 렌더러와
   * 무관합니다. nanotags 로 옮길 때 만든 것이 **그대로 살아남았습니다** —
   * 갈아타도 버려지지 않는 부분입니다.
   */

  interface Props {
    editor: EditorContext | null
  }

  const { editor }: Props = $props()

  const ICON_SIZE = 16

  function insert(): void {
    editor?.eventBus.emit(ContentEvents.HORIZONTAL_RULE_INSERT)
  }
</script>

<button
  type="button"
  data-part="icon-button"
  title="Insert Horizontal Rule"
  aria-label="Insert Horizontal Rule"
  onclick={insert}
>
  <!-- eslint-disable-next-line svelte/no-at-html-tags -->
  {@html icon(Minus, ICON_SIZE).outerHTML}
</button>
