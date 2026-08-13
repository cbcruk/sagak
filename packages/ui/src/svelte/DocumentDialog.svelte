<script lang="ts">
  import type { EditorContext } from 'sagak-core'
  import {
    attachDocument,
    open as openDocument,
    readDocument,
    refresh,
    remove,
    rename,
    subscribeToDocument,
  } from '../state/document-store'

  /**
   * 문서 목록 — 열기 · 이름 바꾸기 · 지우기.
   *
   * ## 지우기를 두 번 누르게 합니다
   *
   * 문서를 지우면 되돌릴 방법이 없습니다 — 되돌리기는 편집 내용을 위한
   * 것이지 저장소를 위한 것이 아닙니다. 그래서 한 번 더 묻습니다.
   *
   * 확인 창을 따로 띄우지 않고 **그 자리에서 버튼이 바뀝니다.** 다이얼로그
   * 위에 다이얼로그를 얹으면 `<dialog>` 두 개가 겹쳐 포커스가 꼬입니다.
   *
   * ## 값은 저장소에서 옵니다
   *
   * 문서 줄과 이 목록이 **같은 문서를 봐야** 합니다. 그래서 상태가
   * `state/document-store.ts` 에 있고 둘 다 그것을 구독합니다 — 컴포넌트마다
   * 사본을 들면 제목과 목록이 어긋납니다.
   */

  interface Props {
    editor: EditorContext | null
    /** 이름을 받아 옵니다 — 기본은 브라우저 프롬프트입니다 */
    requestName?: (current: string) => string | null
  }

  const {
    editor,
    requestName = (current: string) => window.prompt('New name', current),
  }: Props = $props()

  let dialogEl: HTMLDialogElement
  let doc = $state(readDocument())
  /** 지우기를 한 번 눌러 확인을 기다리는 문서 */
  let confirming = $state<string | null>(null)

  $effect(() => {
    if (!editor) return
    attachDocument(editor)
    const sync = (): void => {
      doc = readDocument()
    }
    sync()
    return subscribeToDocument(sync)
  })

  function openList(): void {
    confirming = null
    void refresh()
    dialogEl.showModal()
  }

  const formatSize = (bytes: number): string =>
    bytes < 1024 ? `${bytes} B` : `${Math.round(bytes / 1024)} KB`

  const formatDate = (timestamp: number): string =>
    new Date(timestamp).toLocaleString()
</script>

<button
  type="button"
  k="menubar-item"
  data-part="documents"
  title="Documents"
  onclick={openList}
>
  Documents…
</button>

<dialog bind:this={dialogEl} k="dialog-content" aria-label="Documents">
  <h2>Documents</h2>

  {#if doc.documents.length === 0}
    <p data-part="empty" style="margin: 16px 0; color: var(--sagak-chrome-muted-fg)">
      No saved documents yet.
    </p>
  {:else}
    <div
      data-part="list"
      style="display: flex; flex-direction: column; gap: 4px; margin: 8px 0; max-height: 280px; overflow-y: auto"
    >
      {#each doc.documents as item (item.name)}
        <div data-part="row" data-name={item.name}>
          <div style="display: flex; align-items: center; gap: 8px; padding: 4px 0">
            <button
              type="button"
              data-part="open"
              style="flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-align: left"
              aria-current={item.name === doc.name ? 'true' : undefined}
              onclick={() => {
                dialogEl.close()
                if (editor) void openDocument(editor, item.name)
              }}
            >
              {item.name}
            </button>

            <span
              data-part="meta"
              style="flex: none; font-size: 12px; color: var(--sagak-chrome-muted-fg)"
            >
              {formatSize(item.size)} · {formatDate(item.modifiedAt)}
            </span>

            <button
              type="button"
              k="button"
              data-part="rename"
              onclick={() => {
                const next = requestName(item.name)
                if (!next) return
                void rename(item.name, next)
              }}
            >
              Rename
            </button>

            {#if confirming === item.name}
              <button
                type="button"
                k="button"
                data-part="confirm-delete"
                onclick={() => {
                  confirming = null
                  void remove(item.name)
                }}
              >
                Really delete?
              </button>
            {:else}
              <button
                type="button"
                k="button"
                data-part="delete"
                onclick={() => (confirming = item.name)}
              >
                Delete
              </button>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  {/if}

  <div style="display: flex; gap: 8px; justify-content: flex-end">
    <button type="button" k="button" onclick={() => dialogEl.close()}>Close</button>
  </div>
</dialog>
