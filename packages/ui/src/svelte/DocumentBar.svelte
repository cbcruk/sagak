<script lang="ts">
  import type { EditorContext } from 'sagak-core'
  import DocumentDialog from './DocumentDialog.svelte'
  import {
    attachDocument,
    create,
    documentStore,
    readNow,
    save,
    saveAs,
  } from '../state/document-store'
  import {
    canSaveToComputer,
    saveToComputer,
  } from '../components/document-bar/document-bar.utils'

  /**
   * 문서 줄 — 레거시 텍스트 에디터의 제목과 메뉴입니다.
   *
   * 새로 만들기 · 열기 · 저장(⌘S) · 다른 이름으로 저장. 자동 저장은 없으므로
   * **저장은 여기서만 일어납니다** (`docs/document-model.md`).
   *
   * ## 동작은 kinu `Menubar` 가 아니라 여기 그대로 있습니다
   *
   * 메뉴 자리는 kinu 의 모양(`[k=menubar]`·`[k=menubar-item]`)만 받습니다.
   * 항목은 여전히 한 번 누르면 그 동작이 바로 일어납니다.
   *
   * 드롭다운으로 접지 않은 이유는 저장이 **두 번 클릭**이 되기 때문입니다.
   * 자동 저장이 없는 에디터에서 가장 자주 누르는 것이 저장인데, 그걸 한 겹
   * 안으로 넣는 것은 모양을 위해 사용을 나쁘게 만드는 쪽입니다.
   *
   * ## 저장 상태가 여기 있는 이유
   *
   * 예전 자동 저장 표시는 툴바 구석에서 `Unsaved changes` 와 `Saved at …` 를
   * 오갔고, 사람처럼 3번 치고 쉬면 **6번** 바뀌었습니다. 글 쓰는 내내 시야
   * 가장자리가 움직여서 결국 내렸습니다.
   *
   * 문서에 이름이 생기면 그 자리가 제목 옆이 됩니다. 바뀌는 것은 점 하나뿐이고,
   * 2초마다가 아니라 **저장할 때와 고칠 때**만 바뀝니다.
   *
   * ```
   * ● 메모.html    저장 안 됨
   *   메모.html    저장됨
   * ```
   *
   * ## 두 효과는 컴포넌트에 남습니다
   *
   * ⌘S 와 닫기 경고는 **이 컴포넌트가 떠 있는 동안만** 걸려야 하는 것이라
   * 저장소로 올리지 않았습니다. 값(문서 이름·더러움)은 밖에 있고 배선은
   * 안에 있습니다 — 폰트 목록·선택 영역에서 정한 것과 같은 가름입니다.
   */

  interface Props {
    editor: EditorContext
    /**
     * 이름을 받아 옵니다 — 기본은 브라우저 프롬프트입니다.
     *
     * 프로퍼티로 뺀 이유는 둘입니다. 나중에 이 저장소의 다이얼로그로 바꾸기
     * 쉽고, 테스트가 사람 없이 이름을 넣을 수 있습니다.
     */
    requestName?: (current: string) => string | null
  }

  const {
    editor,
    requestName = (current: string) => window.prompt('Document name', current),
  }: Props = $props()

  $effect(() => {
    attachDocument(editor)
  })

  /** 이름이 없으면 물어보고 저장합니다 — 레거시 에디터의 ⌘S 그대로입니다 */
  async function saveOrAsk(): Promise<void> {
    if (!$documentStore.untitled) {
      await save(editor)
      return
    }
    const next = requestName('Untitled.html')
    if (!next) return
    await saveAs(editor, next)
  }

  async function askAndSaveAs(): Promise<void> {
    const next = requestName($documentStore.name)
    if (!next) return
    await saveAs(editor, next)
  }

  /**
   * 진짜 파일로 꺼냅니다.
   *
   * 대화상자를 먼저 띄우고 그 뒤에 내용을 읽습니다 — 순서가 바뀌면 사용자
   * 제스처를 잃어 대화상자가 안 뜹니다 (`document-bar.utils`).
   */
  function exportToComputer(): void {
    void saveToComputer($documentStore.untitled ? 'Untitled.html' : $documentStore.name, () =>
      readNow(editor)
    )
  }

  /*
   * ⌘S 는 **문서** 동작이라 편집 커맨드용 단축키 플러그인과 층이 다릅니다.
   * 그쪽은 편집 영역 안에서만 듣지만, 저장은 어디에 포커스가 있든 되어야
   * 합니다.
   */
  $effect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 's' || (!event.metaKey && !event.ctrlKey)) return
      event.preventDefault()
      void saveOrAsk()
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  })

  /*
   * 자동 저장이 없으므로 이 경고가 **마지막 방어선**입니다. 저장 안 한 채로
   * 닫으면 글이 사라집니다.
   */
  $effect(() => {
    if (!$documentStore.dirty) return

    const onBeforeUnload = (event: BeforeUnloadEvent): void => {
      event.preventDefault()
      event.returnValue = ''
    }

    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  })
</script>

{#if $documentStore.available}
  <div
    data-scope="document-bar"
    data-part="root"
    style="display: flex; align-items: center; gap: 8px"
  >
    <span
      data-part="title"
      style="display: flex; align-items: center; min-width: 0; font-size: 13px; font-weight: 500"
    >
      <!--
        점이 들어갈 자리는 **늘 잡아 둡니다.** 점이 나타났다 사라질 때 제목이
        좌우로 밀리면, 예전 자동 저장 표시에서 고쳤던 흔들림이 됩니다.
      -->
      <span
        data-part="dot"
        style="display: inline-block; width: 1em; flex: none; text-align: center"
        aria-hidden="true">{$documentStore.dirty ? '●' : ''}</span
      >
      <span
        data-part="name"
        style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap"
        >{$documentStore.name}</span
      >
    </span>

    <div k="menubar" data-part="actions" aria-label="Document">
      <button
        type="button"
        k="menubar-item"
        data-part="new"
        onclick={() => {
          if (editor) void create(editor)
        }}
      >
        New
      </button>

      <DocumentDialog {editor} {requestName} />

      <button
        type="button"
        k="menubar-item"
        data-part="save"
        onclick={() => void saveOrAsk()}
      >
        Save
      </button>

      <button
        type="button"
        k="menubar-item"
        data-part="save-as"
        onclick={() => void askAndSaveAs()}
      >
        Save As…
      </button>

      <!--
        진짜 파일은 Chromium 계열에만 있습니다. 없는 브라우저에서는 아예
        안 내놓습니다 — `docs/toolbar-options.md` 의 규칙과 같습니다.
      -->
      {#if canSaveToComputer()}
        <button
          type="button"
          k="menubar-item"
          data-part="save-to-computer"
          title="Save a copy to your computer"
          onclick={exportToComputer}
        >
          Save to Computer…
        </button>
      {/if}
    </div>
  </div>
{/if}
