<script lang="ts">
  import { Cloud, CloudOff, LoaderCircle, Check, CircleAlert } from 'lucide'
  import { autoSave, type AutoSaveStatus } from 'sagak-core'
  import type { EditorContext } from 'sagak-core'
  import type { IconNode } from 'lucide'
  import { icon } from '../elements/icon'
  import {
    DELETED_MS,
    DELETED_TEXT,
    WIDEST_LABELS,
    formatTime,
  } from '../components/auto-save-indicator/auto-save-indicator.shared'

  /**
   * 자동 저장 표시 — **레이아웃 불변식**이 걸린 컴포넌트입니다.
   *
   * 예전에 여기 때문에 두 번 고쳤습니다. 처음 뜰 때 아래가 23px 내려갔고,
   * 상태가 바뀔 때마다 옆 버튼이 최대 50.7px 튀었습니다. 그래서 검사 아홉이
   * 붙어 있고, 옮기는 입장에서는 **관문이 가장 튼튼한** 자리입니다.
   *
   * 지켜야 하는 것 둘:
   *
   * 1. **항상 자리를 차지합니다.** 보일 것이 없으면 내용만 감추고 자리는
   *    지킵니다 — `visibility: hidden` 이지 `display: none` 이 아닙니다.
   * 2. **문구 칸의 폭이 안 변합니다.** 후보를 전부 같은 격자 칸에 겹쳐 두고
   *    하나만 보이게 해서 브라우저가 가장 긴 것으로 폭을 잡게 합니다. 픽셀을
   *    손으로 적지 않습니다.
   *
   * ## 타이머는 컴포넌트에 남습니다
   *
   * "지웠음" 문구를 4초 뒤에 거두는 타이머는 **이 표시의 것**이라 모듈로
   * 올릴 이유가 없습니다. 색 고르개의 바깥 클릭 리스너와 같은 갈래입니다.
   *
   * 다만 Preact 판이 여기서 한 번 틀렸던 것은 그대로 피합니다 — 클릭 시점에는
   * 아직 `status` 가 `saved` 라, 상태를 효과로 맞추려 하면 직전 렌더의 효과가
   * 뒤늦게 흘러나와 방금 켠 플래그를 도로 끕니다. 그래서 **끌어냅니다**:
   * `showDeleted = justDeleted && status === 'idle'`.
   *
   * ## 마지막 저장 시각은 이제 코어의 것입니다
   *
   * 예전에는 `timestamp` 가 `saved` 일 때만 실려 와서, 여기서 그것을 쟁여 두고
   * 다음 상태들에 걸쳐 유지하다가 지우기를 누르면 제 손으로 `null` 로
   * 되돌렸습니다 — 상태 하나를 두 곳에서 관리한 셈입니다. `savedAt` 이 코어
   * 상태의 일부가 되면서 여기는 그리기만 합니다.
   */

  interface Props {
    editor: EditorContext
    /** 저장 시각을 문구에 넣습니다 */
    showTime?: boolean
  }

  const { editor, showTime = true }: Props = $props()

  interface View {
    node: IconNode
    text: string
    color: string
    spin?: boolean
  }

  let status = $state<AutoSaveStatus>('idle')
  let savedAt = $state<number | null>(null)
  let justDeleted = $state(false)
  let timer: ReturnType<typeof setTimeout> | null = null

  function viewFor(): View {
    switch (status) {
      case 'pending':
        return {
          node: Cloud,
          text: 'Unsaved changes',
          color: 'var(--sagak-chrome-muted-fg)',
        }
      case 'saving':
        return {
          node: LoaderCircle,
          text: 'Saving...',
          color: '#3b82f6',
          spin: true,
        }
      case 'saved':
        return {
          node: Check,
          text:
            showTime && savedAt
              ? `Saved at ${formatTime(new Date(savedAt))}`
              : 'Saved',
          color: '#22c55e',
        }
      case 'error':
        return { node: CircleAlert, text: 'Save failed', color: '#ef4444' }
      case 'idle':
      default:
        return {
          node: CloudOff,
          text: '',
          color: 'var(--sagak-chrome-muted-fg)',
        }
    }
  }

  /** 지운 직후 잠깐만, 그리고 정말 비어 있을 때만 확인 문구를 냅니다 */
  const showDeleted = $derived(justDeleted && status === 'idle')

  const view = $derived.by((): View => {
    const base = viewFor()
    return showDeleted
      ? { ...base, text: DELETED_TEXT, color: 'var(--sagak-chrome-muted-fg)' }
      : base
  })

  const hidden = $derived(status === 'idle' && !savedAt && !showDeleted)

  $effect(() =>
    autoSave(editor).subscribe((state) => {
      status = state.status
      savedAt = state.savedAt
    })
  )

  $effect(() => () => {
    if (timer) clearTimeout(timer)
  })

  function discard(): void {
    autoSave(editor).clear()
    justDeleted = true

    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      justDeleted = false
    }, DELETED_MS)
  }

  const LAYER = 'grid-area: 1 / 1; white-space: nowrap'
</script>

<div
  data-scope="auto-save"
  data-part="indicator"
  data-status={status}
  style="display: flex; align-items: center; gap: 6px; font-size: 12px; color: {view.color}; visibility: {hidden
    ? 'hidden'
    : 'visible'}"
>
  <span style="display: inline-flex">
    {@html (() => {
      const svg = icon(view.node, 14)
      if (view.spin) svg.setAttribute('class', 'animate-spin')
      return svg.outerHTML
    })()}
  </span>

  <!--
    문구 칸 — 후보를 전부 같은 격자 칸에 겹쳐 둡니다. 감춰진 것들도
    `visibility` 라 자리는 차지하므로 폭이 늘 가장 긴 후보가 됩니다.
  -->
  <span style="display: grid; justify-items: start">
    {#each WIDEST_LABELS as label (label)}
      <span aria-hidden="true" style="{LAYER}; visibility: hidden">{label}</span>
    {/each}
    <span style={LAYER}>{view.text}</span>
  </span>

  <!--
    버튼 자리도 **늘 잡아 둡니다.**

    버튼은 저장된 초안이 있을 때만 나옵니다(없으면 지울 것도 없으니까요).
    그런데 나타나고 사라지면 표시 전체의 폭이 바뀌고, 툴바가 `flex-wrap`
    이라 그 폭이 줄바꿈 자리를 건드릴 수 있습니다 — 좁은 화면에서 저장이
    끝나는 순간 툴바가 한 줄 늘어납니다.

    문구 칸과 같은 수를 씁니다. 같은 격자 칸에 감춘 사본을 겹쳐 두어 폭을
    잡아 두고, 진짜 버튼은 있을 때만 그 위에 올립니다. 버튼 자체는 없을 때
    **정말 없습니다** — `auto-save.browser.test.ts` 가 그것을 봅니다.
  -->
  <span style="display: grid; justify-items: start">
    <span aria-hidden="true" style="{LAYER}; visibility: hidden; font-size: 12px"
      >Delete saved draft</span
    >
    {#if savedAt}
      <button
        type="button"
        title="Deletes the saved draft so it won't be restored next time. Your current text stays as it is, and editing saves again."
        style="{LAYER}; background: none; border: none; padding: 0 2px; font: inherit; font-size: 12px; color: var(--sagak-chrome-muted-fg); cursor: pointer; text-decoration: underline"
        onclick={discard}
      >
        Delete saved draft
      </button>
    {/if}
  </span>
</div>
