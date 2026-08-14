<script lang="ts">
  import type { EditorContext } from 'sagak-core'
  import type { EditorProviderElement } from '../elements/editor-context'
  import '../elements/font-family-select'
  import '../elements/toolbar-selects'
  import '../elements/toolbar-commands'
  import '../elements/toolbar-state-buttons'
  import '../elements/color-picker'
  import '../elements/auto-save-indicator'
  import '../elements/more-menu'
  import '../elements/link-dialog'
  import FormatToggles from './FormatToggles.svelte'
  import ListButtons from './ListButtons.svelte'
  import ImageDialog from './ImageDialog.svelte'
  import TableDialog from './TableDialog.svelte'
  import HorizontalRuleButton from './HorizontalRuleButton.svelte'
  import SpecialCharacterDialog from './SpecialCharacterDialog.svelte'
  import FindReplaceDialog from './FindReplaceDialog.svelte'
  import ExportMenu from './ExportMenu.svelte'

  /**
   * 툴바 — **`SvelteHost` 가 없어지는 자리**입니다.
   *
   * 지금까지는 Preact 툴바 안에 Svelte 조각을 하나씩 띄웠습니다. 껍데기까지
   * 넘어오면서 그 다리가 여덟 개 사라지고, Svelte 컴포넌트를 그냥 씁니다.
   *
   * ## 커스텀 엘리먼트는 그대로입니다
   *
   * 여덟은 아직 nanotags 판입니다. 그것들은 `sagak-editor-provider` 가 DOM
   * 이벤트로 내려 주는 컨텍스트를 받아 갑니다 — **렌더러와 무관한 배선**이라
   * Preact 에서 Svelte 로 옮겨도 손댈 것이 없었습니다.
   *
   * Preact 판은 `ref` 콜백으로 `setEditor()` 를 불렀고 여기서는 `bind:this` +
   * `$effect` 입니다. 그 한 줄이 다릅니다.
   */

  interface Props {
    editor: EditorContext | null
    /**
     * 자동 저장 표시를 툴바에 넣습니다. **기본값은 꺼짐입니다.**
     *
     * 저장이 끝날 때마다 아이콘·색·문구가 통째로 뒤집혀 툴바 구석이
     * 깜빡입니다. 재 보면 **입력 3번에 표시가 6번** 바뀝니다 —
     * `Unsaved changes`(회색 구름) ↔ `Saved at 07:47 PM`(초록 체크) 를
     * 오갑니다.
     *
     * 글을 쓰는 동안 시야 가장자리에서 계속 움직이는 것이라, 알려주는 값보다
     * 방해가 큽니다. 그래서 **일단 내립니다.** 기능 자체는 그대로입니다 —
     * 저장도 복원도 됩니다. 보이지 않을 뿐입니다.
     *
     * 되살릴 조건: 상태가 바뀔 때마다 알리는 대신 **조용해지는 방법**이
     * 생기면 (예: 저장 실패 같은 이상만 알리기, 잠깐 떴다 사라지기).
     */
    showAutoSaveIndicator?: boolean
  }

  const { editor, showAutoSaveIndicator = false }: Props = $props()

  let provider: EditorProviderElement | undefined = $state()

  $effect(() => {
    provider?.setEditor(editor)
  })
</script>

<div data-scope="toolbar" data-part="root" role="toolbar" aria-label="Text formatting">
  <!--
    이주 중 배선 — 커스텀 엘리먼트가 에디터에 닿는 통로입니다.
    `display: contents` 라 툴바의 줄바꿈 계산에는 끼어들지 않습니다.
    남은 여덟까지 Svelte 가 되면 이 배선도 없어집니다.
  -->
  <sagak-editor-provider bind:this={provider}>
    <sagak-history-buttons></sagak-history-buttons>

    <div data-part="separator"></div>

    <sagak-heading-select></sagak-heading-select>

    <div data-part="separator"></div>

    <FormatToggles {editor} />

    <sagak-color-picker type="text"></sagak-color-picker>
    <sagak-color-picker type="background"></sagak-color-picker>

    <div data-part="separator"></div>

    <sagak-font-family-select></sagak-font-family-select>
    <sagak-font-size-select></sagak-font-size-select>

    <div data-part="mobile-hidden" style="display: contents">
      <sagak-line-height-select></sagak-line-height-select>
      <sagak-letter-spacing-select></sagak-letter-spacing-select>
    </div>

    <div data-part="separator"></div>

    <sagak-alignment-buttons></sagak-alignment-buttons>

    <div data-part="separator"></div>

    <ListButtons {editor} />

    <div data-part="mobile-hidden" style="display: contents">
      <div data-part="separator"></div>
      <div style="display: flex; gap: 4px">
        <sagak-link-dialog></sagak-link-dialog>
        <ImageDialog {editor} />
        <TableDialog {editor} />
        <HorizontalRuleButton {editor} />
        <SpecialCharacterDialog {editor} />
      </div>

      <div data-part="separator"></div>

      <div style="display: flex; gap: 4px">
        <FindReplaceDialog {editor} />
        <ExportMenu {editor} />
      </div>
    </div>

    <sagak-more-menu></sagak-more-menu>

    <!--
      자동 저장 표시는 **툴바 안**에 있습니다. 예전에는 툴바와 편집 영역
      사이의 독립된 줄이었는데, 그러면 처음 뜰 때 아래가 23px 밀렸습니다.
      툴바는 이미 자기 높이를 갖고 있으므로 여기 얹으면 새 공간을 안 씁니다.

      `margin-left: auto` 로 오른쪽 끝에 붙입니다. 툴바가 `flex-wrap: wrap`
      이라 좁은 화면에서는 마지막 줄로 내려갑니다 — 그건 폭에 따른 것이지
      저장 상태에 따른 것이 아니므로 글을 쓰는 중에 움직이지 않습니다
      (`test/auto-save-layout.browser.test.tsx`).
    -->
    {#if showAutoSaveIndicator}
      <div data-part="trailing" style="margin-left: auto">
        <sagak-auto-save-indicator></sagak-auto-save-indicator>
      </div>
    {/if}
  </sagak-editor-provider>
</div>
