<script lang="ts">
  import { Undo2, Redo2 } from 'lucide'
  import { icon } from '../elements/icon'

  /**
   * 실행 취소 · 다시 실행.
   *
   * 처음에는 둘 다 눌리지 않습니다 — 되돌릴 것이 아직 없습니다. 그 뒤로는
   * 코어가 발행하는 `HISTORY_STATE_CHANGED` 를 그대로 따릅니다.
   *
   * 이 상태는 렌더러를 세 번 갈아타는 동안 **한 번도 안 바뀌었습니다.** Preact
   * 시절에는 훅이 이 이벤트를 시그널로 감쌌고, nanotags 와 여기서는 직접
   * 들었습니다. 감싸는 층만 달랐지 사실은 늘 코어에 있었습니다.
   *
   * 그래서 듣는 일을 `state/history.svelte.ts` 로 옮겼습니다. 여기 남은 것은
   * **불리언 둘과 의도 둘**이고, 서명만 봐도 이 컴포넌트가 무엇에 기대는지
   * 보입니다 — `editor: EditorContext` 는 "에디터 전부를 달라"라 그게 안
   * 보였습니다.
   */

  interface Props {
    canUndo: boolean
    canRedo: boolean
    onundo: () => void
    onredo: () => void
  }

  const { canUndo, canRedo, onundo, onredo }: Props = $props()
</script>

<div data-part="icon-button-group" role="group" aria-label="History">
  <button
    type="button"
    data-part="icon-button"
    title="Undo (⌘Z)"
    aria-label="Undo"
    disabled={!canUndo}
    onclick={onundo}
  >
    {@html icon(Undo2, 16).outerHTML}
  </button>
  <button
    type="button"
    data-part="icon-button"
    title="Redo (⌘⇧Z)"
    aria-label="Redo"
    disabled={!canRedo}
    onclick={onredo}
  >
    {@html icon(Redo2, 16).outerHTML}
  </button>
</div>
