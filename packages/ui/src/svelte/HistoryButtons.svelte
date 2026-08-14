<script lang="ts">
  import { Undo2, Redo2 } from 'lucide'
  import { HistoryEvents } from 'sagak-core'
  import type { EditorContext } from 'sagak-core'
  import { icon } from '../elements/icon'

  /**
   * 실행 취소 · 다시 실행.
   *
   * 처음에는 둘 다 눌리지 않습니다 — 되돌릴 것이 아직 없습니다. 그 뒤로는
   * 코어가 발행하는 `HISTORY_STATE_CHANGED` 를 그대로 따릅니다.
   *
   * 이 상태는 렌더러를 세 번 갈아타는 동안 **한 번도 안 바뀌었습니다.** Preact
   * 시절에는 훅이 이 이벤트를 시그널로 감쌌고, nanotags 와 여기서는 직접
   * 듣습니다. 감싸는 층만 달랐지 사실은 늘 코어에 있었습니다.
   */

  interface Props {
    editor: EditorContext | null
  }

  const { editor }: Props = $props()

  let canUndo = $state(false)
  let canRedo = $state(false)

  $effect(() => {
    if (!editor) return
    return editor.eventBus.on(
      HistoryEvents.HISTORY_STATE_CHANGED,
      'after',
      (state?: unknown) => {
        const next = (state ?? {}) as { canUndo?: boolean; canRedo?: boolean }
        canUndo = !!next.canUndo
        canRedo = !!next.canRedo
      }
    )
  })
</script>

<div data-part="icon-button-group" role="group" aria-label="History">
  <button
    type="button"
    data-part="icon-button"
    title="Undo (⌘Z)"
    aria-label="Undo"
    disabled={!canUndo}
    onclick={() => editor?.eventBus.emit(HistoryEvents.UNDO)}
  >
    {@html icon(Undo2, 16).outerHTML}
  </button>
  <button
    type="button"
    data-part="icon-button"
    title="Redo (⌘⇧Z)"
    aria-label="Redo"
    disabled={!canRedo}
    onclick={() => editor?.eventBus.emit(HistoryEvents.REDO)}
  >
    {@html icon(Redo2, 16).outerHTML}
  </button>
</div>
