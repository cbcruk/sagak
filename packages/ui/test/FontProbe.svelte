<script lang="ts">
  import { familiesStore, statusStore } from '../src/state/local-fonts'

  /**
   * 폰트 목록 저장소를 **바깥에서 들여다보는 창**입니다.
   *
   * 재려는 것은 "여러 곳이 같은 사실을 본다" 는 것이라, 창을 여럿 띄워
   * 값이 갈리는지 봅니다. 예전에는 Preact 훅(`useLocalFonts`)이 이 자리에
   * 있었는데 앱이 Svelte 가 되면서 훅이 없어졌습니다. 재는 대상은
   * 그대로입니다 — 저장소는 렌더러를 안 봅니다.
   *
   * 저장소가 `svelte/store` 가 되면서 창을 여는 코드도 없어졌습니다. 손으로
   * 걸던 구독과 해제가 `$` 하나입니다.
   */
</script>

<span data-probe>{$statusStore}:{$familiesStore.length}</span>
