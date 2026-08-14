<script lang="ts">
  import { Link } from 'lucide'
  import { ContentEvents } from 'sagak-core'
  import type { EditorContext } from 'sagak-core'
  import { icon } from '../elements/icon'
  import { subscribeToSelection } from '../hooks/use-selection-derived'
  import { getSelectedLink } from '../components/link-dialog/link-dialog.shared'

  /**
   * 링크 다이얼로그.
   *
   * 커스텀 엘리먼트 시절 **kinu 를 안 쓰고 만든 첫 다이얼로그**였습니다.
   * 그때 `primitives.ts` 의 `dialog()`·`input()`·`button()` 으로 손수 세운
   * 마크업이, 여기서는 그냥 마크업입니다 — 원시 요소를 만드는 층이 통째로
   * 필요 없어집니다.
   *
   * ## 순서가 중요합니다
   *
   * 1. 여는 클릭에서 **선택 영역을 저장**하고 URL 을 미리 채웁니다 — 열린
   *    뒤에는 포커스가 다이얼로그로 넘어가 늦습니다.
   * 2. 적용은 **닫은 다음 프레임**에 합니다. 닫히기 전에 되돌리면 다이얼로그가
   *    아직 포커스를 쥐고 있어 선택이 다시 풀립니다.
   *
   * ## 지우기는 범위를 다시 잡습니다
   *
   * 링크 전체를 선택 영역으로 잡아야 코어가 그 범위를 풀 수 있습니다.
   * 캐럿만 얹혀 있으면 아무것도 안 지워집니다.
   */

  interface Props {
    editor: EditorContext | null
    /** 좁은 화면에서 트리거를 감춥니다 — 자세한 이유는 아래 */
    hideTrigger?: boolean
  }

  const { editor, hideTrigger = false }: Props = $props()

  let dialogEl: HTMLDialogElement
  let url = $state('')
  let onLink = $state(false)

  $effect(() => {
    if (!editor) return
    const sync = (): void => {
      onLink = !!getSelectedLink()
    }
    sync()
    return subscribeToSelection(editor, sync)
  })

  export function open(): void {
    editor?.selectionManager?.saveSelection()
    url = getSelectedLink()?.href ?? ''
    dialogEl.showModal()
  }

  /** 닫은 다음 프레임에 선택을 되돌리고 적용합니다 */
  function restoreThen(action: () => void): void {
    dialogEl.close()
    requestAnimationFrame(() => {
      editor?.selectionManager?.restoreSelection()
      action()
    })
  }

  function submit(): void {
    const trimmed = url.trim()
    /* URL 이 비어 있어도 닫기는 합니다 */
    if (!trimmed) {
      dialogEl.close()
      return
    }
    restoreThen(() => {
      editor?.eventBus.emit(ContentEvents.LINK_CHANGED, { url: trimmed })
    })
  }

  function remove(): void {
    restoreThen(() => {
      const link = getSelectedLink()
      if (link) {
        const range = document.createRange()
        range.selectNodeContents(link)
        const selection = window.getSelection()
        selection?.removeAllRanges()
        selection?.addRange(range)
      }
      editor?.eventBus.emit(ContentEvents.LINK_REMOVED)
    })
  }
</script>

<button
  type="button"
  data-part="icon-button"
  data-mobile={hideTrigger ? 'hidden' : undefined}
  data-state={onLink ? 'on' : undefined}
  title="Insert Link"
  aria-label="Insert Link"
  onclick={open}
>
  {@html icon(Link, 18).outerHTML}
</button>

<dialog bind:this={dialogEl} k="dialog-content" aria-label="Insert Link">
  <h2>Insert Link</h2>

  <div>
    <label k="label" for="link-url" style="display: block; margin-bottom: 4px; font-size: 14px">
      URL
    </label>
    <input
      id="link-url"
      k="input"
      type="text"
      bind:value={url}
      placeholder="https://example.com"
      onkeydown={(e) => {
        if (e.key === 'Enter') submit()
      }}
    />
  </div>

  <div style="display: flex; gap: 8px; justify-content: flex-end">
    <button type="button" k="button" onclick={remove}>Remove</button>
    <button type="button" k="button" onclick={() => dialogEl.close()}>Cancel</button>
    <button type="button" k="button" onclick={submit}>Insert</button>
  </div>
</dialog>
