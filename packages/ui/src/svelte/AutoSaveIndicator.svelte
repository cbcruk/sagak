<script lang="ts">
  import { Cloud, CloudOff, LoaderCircle, Check, CircleAlert } from 'lucide'
  import { AutoSaveEvents, type AutoSaveStatus } from 'sagak-core'
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
   */

  interface Props {
    editor: EditorContext | null
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
  let lastSaved = $state<Date | null>(null)
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
            showTime && lastSaved
              ? `Saved at ${formatTime(lastSaved)}`
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

  const hidden = $derived(status === 'idle' && !lastSaved && !showDeleted)

  $effect(() => {
    if (!editor) return
    return editor.eventBus.on(
      AutoSaveEvents.AUTO_SAVE_STATUS_CHANGED,
      'on',
      (data?: unknown) => {
        const next = (data ?? {}) as {
          status?: AutoSaveStatus
          timestamp?: number
        }
        if (next.status) status = next.status
        if (next.timestamp) lastSaved = new Date(next.timestamp)
      }
    )
  })

  $effect(() => () => {
    if (timer) clearTimeout(timer)
  })

  function discard(): void {
    editor?.eventBus.emit(AutoSaveEvents.AUTO_SAVE_CLEAR)
    lastSaved = null
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

  <!-- 버튼은 행의 마지막이라 나타나고 사라져도 아무것도 안 밀립니다 -->
  {#if lastSaved}
    <button
      type="button"
      title="Deletes the saved draft so it won't be restored next time. Your current text stays as it is, and editing saves again."
      style="background: none; border: none; padding: 0 2px; font: inherit; font-size: 12px; color: var(--sagak-chrome-muted-fg); cursor: pointer; text-decoration: underline"
      onclick={discard}
    >
      Delete saved draft
    </button>
  {/if}
</div>
