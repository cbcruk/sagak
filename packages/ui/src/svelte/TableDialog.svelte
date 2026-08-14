<script lang="ts">
  import { Table } from 'lucide'
  import { ContentEvents } from 'sagak-core'
  import type { EditorContext } from 'sagak-core'
  import { icon } from '../elements/icon'
  import { subscribeToSelection } from '../hooks/use-selection-derived'
  import { findTableAtSelection } from '../components/table-dialog/table-dialog.shared'

  /**
   * 표 다이얼로그 — **한 다이얼로그가 두 얼굴**을 가집니다.
   *
   * 표 밖이면 "만들기"(행·열 개수), 표 안이면 "고치기"(행·열 추가/삭제).
   * 제목과 `aria-label` 까지 갈립니다.
   *
   * 그 판정이 **선택 영역에서 나옵니다.** 캐럿이 표 안에 있는지 매번 봐야 하고,
   * 그래서 `subscribeToSelection` 을 씁니다 — IME 조합 중 무시·다음 프레임까지
   * 지연·에디터 밖이면 건너뜀 가드가 거기 들어 있습니다. nanotags 때 export 해
   * 둔 것이 렌더러를 두 번 바꾸고도 그대로 쓰입니다.
   *
   * ## 관문이 이미 있었습니다
   *
   * `table-dialog.browser.test.tsx` 의 셋(만들기·편집 모드로 열려 행 추가·표
   * 지우기)이 두 얼굴을 다 지납니다. 링크에 이어 두 번째로 특성 테스트를 새로
   * 안 써도 됐던 경우입니다.
   */

  interface Props {
    editor: EditorContext | null
    /** 좁은 화면에서 트리거를 감춥니다 — 자세한 이유는 아래 */
    hideTrigger?: boolean
  }

  const { editor, hideTrigger = false }: Props = $props()

  let dialogEl: HTMLDialogElement
  let rows = $state('3')
  let cols = $state('3')
  let hasTable = $state(false)

  const rowCount = $derived(parseInt(rows, 10))
  const colCount = $derived(parseInt(cols, 10))
  const isValid = $derived(
    !isNaN(rowCount) && !isNaN(colCount) && rowCount >= 1 && colCount >= 1
  )

  /*
   * 선택이 바뀔 때마다 어느 얼굴인지 다시 봅니다. 다이얼로그가 닫혀 있을 때도
   * 봐야 합니다 — 툴바 버튼의 켜짐 표시가 이 값을 씁니다.
   */
  $effect(() => {
    if (!editor) return
    const sync = (): void => {
      hasTable = !!findTableAtSelection()
    }
    sync()
    return subscribeToSelection(editor, sync)
  })

  export function open(): void {
    editor?.selectionManager?.saveSelection()
    rows = '3'
    cols = '3'
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

  function create(): void {
    if (!isValid) return
    restoreThen(() => {
      editor?.eventBus.emit(ContentEvents.TABLE_CREATE, {
        rows: rowCount,
        cols: colCount,
      })
    })
  }

  const insertRow = (position: 'above' | 'below') => () =>
    restoreThen(() => {
      editor?.eventBus.emit(ContentEvents.TABLE_INSERT_ROW, { position })
    })

  const insertColumn = (position: 'left' | 'right') => () =>
    restoreThen(() => {
      editor?.eventBus.emit(ContentEvents.TABLE_INSERT_COLUMN, { position })
    })

  const emit = (name: string) => () =>
    restoreThen(() => {
      editor?.eventBus.emit(name as never)
    })
</script>

<button
  type="button"
  data-part="icon-button"
  data-mobile={hideTrigger ? 'hidden' : undefined}
  data-state={hasTable ? 'on' : undefined}
  title="Insert Table"
  aria-label="Insert Table"
  onclick={open}
>
  {@html icon(Table, 18).outerHTML}
</button>

<dialog bind:this={dialogEl} k="dialog-content" aria-label={hasTable ? 'Edit Table' : 'Insert Table'}>
  <h2>{hasTable ? 'Edit Table' : 'Insert Table'}</h2>

  {#if !hasTable}
    <div style="display: flex; gap: 12px">
      <div style="flex: 1">
        <label k="label" for="table-rows">Rows</label>
        <input id="table-rows" k="input" type="number" min="1" max="100" bind:value={rows} />
      </div>
      <div style="flex: 1">
        <label k="label" for="table-cols">Columns</label>
        <input id="table-cols" k="input" type="number" min="1" max="50" bind:value={cols} />
      </div>
    </div>

    <div style="display: flex; gap: 8px; justify-content: flex-end">
      <button type="button" k="button" variant="outline" onclick={() => dialogEl.close()}>
        Cancel
      </button>
      <button type="button" k="button" onclick={create} disabled={!isValid}>Insert</button>
    </div>
  {:else}
    <div>
      <label k="label" for="table-row-actions">Row</label>
      <div id="table-row-actions" style="display: flex; gap: 8px">
        <button type="button" k="button" onclick={insertRow('above')}>+ Above</button>
        <button type="button" k="button" onclick={insertRow('below')}>+ Below</button>
        <button type="button" k="button" onclick={emit(ContentEvents.TABLE_DELETE_ROW)}>
          Delete
        </button>
      </div>
    </div>

    <div>
      <label k="label" for="table-col-actions">Column</label>
      <div id="table-col-actions" style="display: flex; gap: 8px">
        <button type="button" k="button" onclick={insertColumn('left')}>+ Left</button>
        <button type="button" k="button" onclick={insertColumn('right')}>+ Right</button>
        <button type="button" k="button" onclick={emit(ContentEvents.TABLE_DELETE_COLUMN)}>
          Delete
        </button>
      </div>
    </div>

    <div style="display: flex; gap: 8px; justify-content: flex-end">
      <button type="button" k="button" variant="outline" onclick={() => dialogEl.close()}>
        Close
      </button>
      <button
        type="button"
        k="button"
        variant="destructive"
        onclick={emit(ContentEvents.TABLE_DELETE)}
      >
        Delete Table
      </button>
    </div>
  {/if}
</dialog>
