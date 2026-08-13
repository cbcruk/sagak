<script lang="ts">
  import { Search } from 'lucide'
  import { CoreEvents, FindReplaceEvents } from 'sagak-core'
  import type { EditorContext } from 'sagak-core'
  import { icon } from '../elements/icon'

  /**
   * 찾기/바꾸기 다이얼로그.
   *
   * ## 옮기면서 지켜야 하는 것 — 옵션은 인자로 넘깁니다
   *
   * Preact 판의 주석에 사연이 적혀 있습니다. 예전에는 체크박스가 상태만 바꾸고
   * `useEffect` 가 그 변화를 보고 다시 찾았는데, 그러면 의존성 배열이 거짓말을
   * 하게 되고 다이얼로그가 열려 있는지 따로 들고 있어야 했습니다.
   *
   * **사용자 동작에 반응하는 일은 핸들러에서 합니다.** 바뀐 값을 직접 넘기면
   * 렌더를 한 번 더 기다릴 필요도 없습니다. Svelte 에서도 같습니다 — `$effect`
   * 로 옵션 변화를 좇고 싶은 유혹이 있지만 같은 함정입니다.
   *
   * ## 닫힘은 `close` 이벤트에 붙입니다
   *
   * Esc 든 Close 버튼이든 **어느 경로로 닫혀도** 강조 표시가 정리되어야 합니다.
   * 버튼 핸들러에만 붙이면 Esc 로 닫았을 때 강조가 남습니다.
   *
   * ## 일치 개수는 코어가 알려줍니다
   *
   * `STYLE_CHANGED` 의 `style === 'find'` 페이로드에서 옵니다. 플러그인은 0부터
   * 세고 표시는 1부터라, 하나도 없으면 `-1` 이 옵니다.
   */

  interface Props {
    editor: EditorContext | null
  }

  const { editor }: Props = $props()

  let dialogEl: HTMLDialogElement
  let findText = $state('')
  let replaceText = $state('')
  let caseSensitive = $state(false)
  let wholeWord = $state(false)
  let matchCount = $state(0)
  let currentMatch = $state(0)

  const hasQuery = $derived(!!findText.trim())

  $effect(() => {
    if (!editor) return
    return editor.eventBus.on(
      CoreEvents.STYLE_CHANGED,
      'after',
      (payload?: unknown) => {
        const data = (payload ?? {}) as {
          style?: string
          matchCount?: number
          matchIndex?: number
        }
        if (data.style !== 'find') return
        if (
          typeof data.matchCount !== 'number' ||
          typeof data.matchIndex !== 'number'
        ) {
          return
        }
        matchCount = data.matchCount
        currentMatch = data.matchIndex < 0 ? 0 : data.matchIndex + 1
      }
    )
  })

  /** 바뀐 옵션을 **인자로** 받습니다 — 렌더를 기다리지 않으려고 */
  function runFind(override?: {
    caseSensitive?: boolean
    wholeWord?: boolean
  }): void {
    if (!findText.trim()) return
    editor?.eventBus.emit(FindReplaceEvents.FIND, {
      query: findText,
      caseSensitive,
      wholeWord,
      ...override,
    })
  }

  function replace(all: boolean): void {
    if (!findText.trim()) return
    editor?.eventBus.emit(
      all ? FindReplaceEvents.REPLACE_ALL : FindReplaceEvents.REPLACE,
      { query: findText, replacement: replaceText, caseSensitive, wholeWord }
    )
  }

  function onClose(): void {
    editor?.eventBus.emit(FindReplaceEvents.CLEAR_FIND)
    matchCount = 0
    currentMatch = 0
  }

  function onFindKeydown(e: KeyboardEvent): void {
    if (e.key !== 'Enter') return
    e.preventDefault()
    if (matchCount > 0) editor?.eventBus.emit(FindReplaceEvents.FIND_NEXT)
    else runFind()
  }
</script>

<button
  type="button"
  data-part="icon-button"
  title="Find &amp; Replace"
  aria-label="Find &amp; Replace"
  onclick={() => dialogEl.showModal()}
>
  {@html icon(Search, 18).outerHTML}
</button>

<dialog bind:this={dialogEl} k="dialog-content" aria-label="Find &amp; Replace" onclose={onClose}>
  <h2>Find &amp; Replace</h2>

  <div>
    <label k="label" for="find-query">Find</label>
    <!-- svelte-ignore a11y_autofocus -->
    <input
      id="find-query"
      k="input"
      type="text"
      bind:value={findText}
      onkeydown={onFindKeydown}
      placeholder="Search text..."
      autofocus
    />
  </div>

  <div>
    <label k="label" for="find-replacement">Replace</label>
    <input
      id="find-replacement"
      k="input"
      type="text"
      bind:value={replaceText}
      placeholder="Replace with..."
    />
  </div>

  <div style="display: flex; gap: 16px">
    <label k="label" style="display: flex; align-items: center; gap: 6px; cursor: pointer">
      <input
        k="checkbox"
        type="checkbox"
        bind:checked={caseSensitive}
        onchange={(e) => runFind({ caseSensitive: e.currentTarget.checked })}
      />
      Case sensitive
    </label>
    <label k="label" style="display: flex; align-items: center; gap: 6px; cursor: pointer">
      <input
        k="checkbox"
        type="checkbox"
        bind:checked={wholeWord}
        onchange={(e) => runFind({ wholeWord: e.currentTarget.checked })}
      />
      Whole word
    </label>
  </div>

  {#if matchCount > 0}
    <p>{currentMatch} of {matchCount} matches</p>
  {/if}

  {#if hasQuery && matchCount === 0 && currentMatch === 0}
    <p>No matches found</p>
  {/if}

  <div style="display: flex; gap: 8px">
    <button type="button" k="button" onclick={() => runFind()} disabled={!hasQuery}>Find</button>
    <button
      type="button"
      k="button"
      variant="outline"
      onclick={() => editor?.eventBus.emit(FindReplaceEvents.FIND_PREVIOUS)}
      disabled={matchCount === 0}
    >
      ↑ Prev
    </button>
    <button
      type="button"
      k="button"
      variant="outline"
      onclick={() => editor?.eventBus.emit(FindReplaceEvents.FIND_NEXT)}
      disabled={matchCount === 0}
    >
      ↓ Next
    </button>
  </div>

  <div style="display: flex; gap: 8px">
    <button
      type="button"
      k="button"
      variant="outline"
      onclick={() => replace(false)}
      disabled={matchCount === 0}
    >
      Replace
    </button>
    <button
      type="button"
      k="button"
      variant="outline"
      onclick={() => replace(true)}
      disabled={matchCount === 0}
    >
      Replace All
    </button>
    <button type="button" k="button" variant="outline" onclick={() => dialogEl.close()}>
      Close
    </button>
  </div>
</dialog>
