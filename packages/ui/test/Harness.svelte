<script lang="ts">
  import type { CreateEditorOptions, Editor } from 'sagak-core'
  import SagakEditor from '../src/svelte/Editor.svelte'
  import Toolbar from '../src/svelte/Toolbar.svelte'
  import DocumentBar from '../src/svelte/DocumentBar.svelte'
  import AutocompletePopover from '../src/svelte/AutocompletePopover.svelte'

  /**
   * `apps/editor` 와 **같은 구성**으로 에디터를 띄웁니다.
   *
   * 이 저장소에서 찾은 UI 버그 — 다크 모드 분열, 다이얼로그가 안 닫힘, 툴바를
   * 쓴 뒤 타이핑 유실 — 는 전부 컴포넌트를 따로 마운트해서는 보이지 않았습니다.
   * 툴바와 편집 영역이 같은 에디터 컨텍스트로 이어져야 드러납니다. 그래서
   * 앱 진입점의 트리를 그대로 재현합니다.
   *
   * **검사 도구 자체도 Svelte 가 됐습니다.** 앱이 Svelte 인데 하네스만 Preact
   * 로 두면, 재는 것과 쓰는 것이 갈립니다.
   */

  interface Props {
    initialContent: string
    autoSave?: CreateEditorOptions['autoSave']
    showAutoSaveIndicator?: boolean
    showDocumentBar?: boolean
    onready: (editor: Editor) => void
  }

  const {
    initialContent,
    autoSave,
    showAutoSaveIndicator,
    showDocumentBar,
    onready,
  }: Props = $props()
</script>

<main data-scope="app">
  <SagakEditor {initialContent} {autoSave} {onready}>
    {#snippet children(editor)}
      {#if showDocumentBar}
        <DocumentBar {editor} />
      {/if}
      <Toolbar {editor} {showAutoSaveIndicator} />
      <AutocompletePopover {editor} />
    {/snippet}
  </SagakEditor>
</main>
