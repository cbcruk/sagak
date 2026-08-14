<script lang="ts">
  import type { EditorContext } from 'sagak-core'
  import ColorPicker from './ColorPicker.svelte'
  import FontFamilySelect from './FontFamilySelect.svelte'
  import ToolbarSelect from './ToolbarSelect.svelte'
  import {
    FONT_SIZE,
    LINE_HEIGHT,
    LETTER_SPACING,
    HEADING,
  } from './toolbar-select.specs'
  import HistoryButtons from './HistoryButtons.svelte'
  import AlignmentButtons from './AlignmentButtons.svelte'
  import FormatToggles from './FormatToggles.svelte'
  import ListButtons from './ListButtons.svelte'
  import LinkDialog from './LinkDialog.svelte'
  import ImageDialog from './ImageDialog.svelte'
  import TableDialog from './TableDialog.svelte'
  import HorizontalRuleButton from './HorizontalRuleButton.svelte'
  import SpecialCharacterDialog from './SpecialCharacterDialog.svelte'
  import FindReplaceDialog from './FindReplaceDialog.svelte'
  import ExportMenu from './ExportMenu.svelte'
  import MoreMenu from './MoreMenu.svelte'
  import AutoSaveIndicator from './AutoSaveIndicator.svelte'

  /**
   * 툴바 — **이주가 끝나는 자리**입니다.
   *
   * 안에 있던 것들이 Preact → 커스텀 엘리먼트 → Svelte 를 거치는 동안, 이
   * 파일은 그때그때 다리를 놓아 왔습니다. 마지막 커스텀 엘리먼트가 넘어오며
   * 그 다리들이 전부 없어졌습니다.
   *
   * ## `sagak-editor-provider` 가 사라졌습니다
   *
   * 커스텀 엘리먼트는 Preact 컨텍스트도 Svelte prop 도 못 봅니다. 그래서
   * 에디터를 DOM 이벤트(W3C 컨텍스트 프로토콜)로 내려 주는 엘리먼트가 툴바
   * 전체를 감싸고 있었습니다. 이제 받을 쪽이 없으니 감쌀 이유도 없습니다 —
   * 전부 `{editor}` 하나로 받습니다.
   *
   * 지울 때 한 번 걸렸습니다. `editor-context.ts` 는 **부작용 import** 로
   * 등록되고 있었는데, 마지막 엘리먼트를 지우며 그 import 도 같이 지웠습니다.
   * 타입만 남은 import 는 컴파일에서 지워지므로 `<sagak-editor-provider>` 가
   * 등록되지 않았고, 53개가 무너졌습니다. 감싸는 것 자체를 걷어내는 것이
   * 답이었습니다.
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

  /*
   * 더보기 메뉴가 열어 줄 다이얼로그들입니다.
   *
   * 좁은 화면에서는 이 트리거들이 감춰지고, 그 기능에 닿는 길이 더보기 메뉴
   * 하나뿐입니다. 그래서 메뉴가 다이얼로그를 직접 열 수 있어야 합니다 —
   * 각 컴포넌트가 `open()` 을 내보내고 여기서 붙듭니다.
   */
  let link: LinkDialog
  let image: ImageDialog
  let table: TableDialog
  let special: SpecialCharacterDialog
  let find: FindReplaceDialog
</script>

<div data-scope="toolbar" data-part="root" role="toolbar" aria-label="Text formatting">
  <HistoryButtons {editor} />

  <div data-part="separator"></div>

  <ToolbarSelect {editor} spec={HEADING} />

  <div data-part="separator"></div>

  <FormatToggles {editor} />

  <ColorPicker {editor} type="text" />
  <ColorPicker {editor} type="background" />

  <div data-part="separator"></div>

  <FontFamilySelect {editor} />
  <ToolbarSelect {editor} spec={FONT_SIZE} />

  <div data-part="mobile-hidden" style="display: contents">
    <ToolbarSelect {editor} spec={LINE_HEIGHT} />
    <ToolbarSelect {editor} spec={LETTER_SPACING} />
  </div>

  <div data-part="separator"></div>

  <AlignmentButtons {editor} />

  <div data-part="separator"></div>

  <ListButtons {editor} />

  <!--
    구분선만 통째로 감춥니다. 다이얼로그를 품은 것들은 **트리거만** 감추고
    (`hideTrigger`), 그래야 더보기 메뉴에서 열었을 때 실제로 보입니다.
  -->
  <div data-part="mobile-hidden" style="display: contents">
    <div data-part="separator"></div>
  </div>

  <div data-mobile="flatten" style="display: flex; gap: 4px">
    <LinkDialog bind:this={link} {editor} hideTrigger />
    <ImageDialog bind:this={image} {editor} hideTrigger />
    <TableDialog bind:this={table} {editor} hideTrigger />
    <HorizontalRuleButton {editor} hideTrigger />
    <SpecialCharacterDialog bind:this={special} {editor} hideTrigger />
  </div>

  <div data-part="mobile-hidden" style="display: contents">
    <div data-part="separator"></div>
  </div>

  <div data-mobile="flatten" style="display: flex; gap: 4px">
    <FindReplaceDialog bind:this={find} {editor} hideTrigger />
    <ExportMenu {editor} hideTrigger />
  </div>

  <MoreMenu
    {editor}
    onOpenDialog={(which) => {
      if (which === 'link') link.open()
      else if (which === 'image') image.open()
      else if (which === 'table') table.open()
      else if (which === 'special-character') special.open()
      else find.open()
    }}
  />

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
      <AutoSaveIndicator {editor} />
    </div>
  {/if}
</div>
