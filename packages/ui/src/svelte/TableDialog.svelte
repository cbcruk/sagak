<script lang="ts">
  import { Table } from 'lucide'
  import { exec } from '../state/exec'
  import type { EditorContext } from 'sagak-core'
  import { icon } from '../elements/icon'
  import { editorState } from '../state/editor-state'

  /**
   * 표 다이얼로그 — **한 다이얼로그가 두 얼굴**을 가집니다.
   *
   * 표 밖이면 "만들기"(행·열 개수), 표 안이면 "고치기"(행·열 추가/삭제).
   * 제목과 `aria-label` 까지 갈립니다.
   *
   * 그 판정이 **문서에서 나옵니다.** 캐럿이 표 안에 있는지 매번 봐야 하고,
   * 그 구독은 `state/table.ts` 가 갖습니다 — `prosemirror-tables` 의
   * `isInTable` 이 답합니다. 예전에는 캐럿에서 `parentNode` 를 타고 올라가며
   * `TABLE` 태그를 찾았고, 그 짐작이 믿을 만한지 보려고 가드가 셋 필요했습니다.
   *
   * ## 관문이 이미 있었습니다
   *
   * `table-dialog.browser.test.tsx` 의 셋(만들기·편집 모드로 열려 행 추가·표
   * 지우기)이 두 얼굴을 다 지납니다. 링크에 이어 두 번째로 특성 테스트를 새로
   * 안 써도 됐던 경우입니다.
   */

  interface Props {
    editor: EditorContext
    /** 좁은 화면에서 트리거를 감춥니다 — 자세한 이유는 아래 */
    hideTrigger?: boolean
  }

  const { editor, hideTrigger = false }: Props = $props()

  let dialogEl: HTMLDialogElement
  let rows = $state('3')
  let cols = $state('3')

  const rowCount = $derived(parseInt(rows, 10))
  const colCount = $derived(parseInt(cols, 10))
  const isValid = $derived(
    !isNaN(rowCount) && !isNaN(colCount) && rowCount >= 1 && colCount >= 1
  )

  /*
   * 어느 얼굴인지는 선택이 바뀔 때마다 다시 봅니다. 다이얼로그가 닫혀 있을 때도
   * 봐야 합니다 — 툴바 버튼의 켜짐 표시가 같은 값을 씁니다. 구독은
   * `state/table.ts` 가 갖습니다.
   */
  // svelte-ignore state_referenced_locally
  const { table: hasTable } = editorState(editor)

  export function open(): void {
    rows = '3'
    cols = '3'
    dialogEl.showModal()
  }

  /**
   * 닫은 **다음 프레임**에 적용합니다.
   *
   * 예전에는 여기서 선택 영역도 되돌렸습니다 — 다이얼로그가 포커스를 가져가면
   * 브라우저 선택이 풀렸기 때문입니다. 이제 선택은 문서 상태의 일부라 그럴
   * 필요가 없지만, **닫고 나서 적용한다** 는 순서는 남습니다. 다이얼로그가 아직
   * 열려 있는 동안 커맨드를 돌리면 포커스 되돌리기가 그 위에서 일어납니다.
   */
  function restoreThen(action: () => void): void {
    dialogEl.close()
    requestAnimationFrame(() => {
      action()
    })
  }

  function create(): void {
    if (!isValid) return
    restoreThen(() => {
      exec(editor, 'insertTable', { rows: rowCount, cols: colCount })
    })
  }

  const insertRow = (position: 'above' | 'below') => () =>
    restoreThen(() => {
      exec(editor, position === 'above' ? 'addRowBefore' : 'addRowAfter')
    })

  const insertColumn = (position: 'left' | 'right') => () =>
    restoreThen(() => {
      exec(editor, position === 'left' ? 'addColumnBefore' : 'addColumnAfter')
    })

  const emit = (name: 'deleteRow' | 'deleteColumn' | 'deleteTable') => () =>
    restoreThen(() => {
      exec(editor, name)
    })
</script>

<button
  type="button"
  data-part="icon-button"
  data-mobile={hideTrigger ? 'hidden' : undefined}
  data-state={$hasTable ? 'on' : undefined}
  title="Insert Table"
  aria-label="Insert Table"
  onclick={open}
>
  {@html icon(Table, 18).outerHTML}
</button>

<dialog bind:this={dialogEl} k="dialog-content" aria-label={$hasTable ? 'Edit Table' : 'Insert Table'}>
  <h2>{$hasTable ? 'Edit Table' : 'Insert Table'}</h2>

  {#if !$hasTable}
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
        <button type="button" k="button" onclick={emit('deleteRow')}>
          Delete
        </button>
      </div>
    </div>

    <div>
      <label k="label" for="table-col-actions">Column</label>
      <div id="table-col-actions" style="display: flex; gap: 8px">
        <button type="button" k="button" onclick={insertColumn('left')}>+ Left</button>
        <button type="button" k="button" onclick={insertColumn('right')}>+ Right</button>
        <button type="button" k="button" onclick={emit('deleteColumn')}>
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
        onclick={emit('deleteTable')}
      >
        Delete Table
      </button>
    </div>
  {/if}
</dialog>
