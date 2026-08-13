import type { ComponentChildren } from 'preact'
import { useEditorContext } from '../../context/editor-context'
import { type EditorProviderElement } from '../../elements/editor-context'
import '../../elements/font-family-select'
import '../../elements/toolbar-selects'
import '../../elements/toolbar-commands'
import '../../elements/toolbar-state-buttons'
import '../../elements/color-picker'
import '../../elements/auto-save-indicator'
import '../../elements/more-menu'
import '../../elements/link-dialog'
import { SvelteHost } from '../../svelte/host'
import HorizontalRuleButton from '../../svelte/HorizontalRuleButton.svelte'
import ImageDialog from '../../svelte/ImageDialog.svelte'
import TableDialog from '../../svelte/TableDialog.svelte'
import FindReplaceDialog from '../../svelte/FindReplaceDialog.svelte'
import SpecialCharacterDialog from '../../svelte/SpecialCharacterDialog.svelte'
import { ListButtons } from '../list-buttons/list-buttons'
import { ExportMenu } from '../export-menu/export-menu'
import { FormatToggles } from '../format-toggles/format-toggles'

export interface ToolbarProps {
  /**
   * 자동 저장 표시를 툴바에 넣습니다. **기본값은 꺼짐입니다.**
   *
   * 저장이 끝날 때마다 아이콘·색·문구가 통째로 뒤집혀 툴바 구석이
   * 깜빡입니다. 재 보면 **입력 3번에 표시가 6번** 바뀝니다 —
   * `Unsaved changes`(회색 구름) ↔ `Saved at 07:47 PM`(초록 체크) 를 오갑니다.
   *
   * 글을 쓰는 동안 시야 가장자리에서 계속 움직이는 것이라, 알려주는 값보다
   * 방해가 큽니다. 그래서 **일단 내립니다.**
   *
   * 기능 자체는 그대로입니다 — 저장도 복원도 됩니다. 보이지 않을 뿐입니다.
   *
   * 되살릴 조건: 상태가 바뀔 때마다 알리는 대신 **조용해지는 방법**이 생기면
   * (예: 저장 실패 같은 이상만 알리기, 잠깐 떴다 사라지기). 그때 이 기본값을
   * 되돌립니다.
   */
  showAutoSaveIndicator?: boolean
}

export function Toolbar({
  showAutoSaveIndicator = false,
}: ToolbarProps = {}): ComponentChildren {
  const context = useEditorContext()

  return (
    <div
      data-scope="toolbar"
      data-part="root"
      role="toolbar"
      aria-label="Text formatting"
    >
      {/*
        이주 중 배선 — 커스텀 엘리먼트가 에디터에 닿는 통로입니다.

        Preact 컨텍스트는 커스텀 엘리먼트가 못 봅니다. provider 가 DOM 이벤트로
        내려 주고, 아래의 `sagak-*` 들이 받아 갑니다. `display: contents` 라
        툴바의 줄바꿈 계산에는 끼어들지 않습니다.

        툴바가 전부 넘어가면 이 배선은 앱 진입점으로 올라갑니다.
      */}
      <sagak-editor-provider
        ref={(el: EditorProviderElement | null) => el?.setEditor(context)}
      >
      <sagak-history-buttons />

      <div data-part="separator" />

      {/* Heading/Paragraph */}
      <sagak-heading-select />

      <div data-part="separator" />

      <FormatToggles />

      {/* Colors */}
      <sagak-color-picker type="text" />
      <sagak-color-picker type="background" />

      <div data-part="separator" />

      {/* Font Family, Size - always visible */}
      <sagak-font-family-select />
      <sagak-font-size-select />

      {/* Line Height & Letter Spacing - hidden on mobile */}
      <div data-part="mobile-hidden" style={{ display: 'contents' }}>
        <sagak-line-height-select />
        <sagak-letter-spacing-select />
      </div>

      <div data-part="separator" />

      {/* Alignment */}
      <sagak-alignment-buttons />

      <div data-part="separator" />

      {/* Lists */}
      <ListButtons />

      {/* Link, Image, Table, HR, Special Characters - hidden on mobile */}
      <div data-part="mobile-hidden" style={{ display: 'contents' }}>
        <div data-part="separator" />
        <div style={{ display: 'flex', gap: 4 }}>
          <sagak-link-dialog />
          <SvelteHost component={ImageDialog} />
          <SvelteHost component={TableDialog} />
          <SvelteHost component={HorizontalRuleButton} />
          <SvelteHost component={SpecialCharacterDialog} />
        </div>

        <div data-part="separator" />

        {/* Find & Export */}
        <div style={{ display: 'flex', gap: 4 }}>
          <SvelteHost component={FindReplaceDialog} />
          <ExportMenu />
        </div>
      </div>

      {/* More Menu - visible on mobile */}
      <sagak-more-menu />

      {/*
        자동 저장 표시는 **툴바 안**에 있습니다 (`showAutoSaveIndicator`).

        예전에는 툴바와 편집 영역 사이의 독립된 줄이었는데, 그러면 처음
        뜰 때 아래가 23px 밀렸습니다. 툴바는 이미 자기 높이를 갖고 있으므로
        여기 얹으면 새 공간을 안 씁니다.

        `margin-left: auto` 로 오른쪽 끝에 붙입니다. 툴바가
        `flex-wrap: wrap` 이라 좁은 화면에서는 마지막 줄로 내려갑니다 —
        그건 폭에 따른 것이지 저장 상태에 따른 것이 아니므로 글을 쓰는
        중에 움직이지 않습니다 (`test/auto-save-layout.browser.test.tsx`).

        지금은 기본값이 꺼짐입니다 — 이유는 `ToolbarProps` 참고.
      */}
      {showAutoSaveIndicator && (
        <div data-part="trailing" style={{ marginLeft: 'auto' }}>
          <sagak-auto-save-indicator />
        </div>
      )}
      </sagak-editor-provider>
    </div>
  )
}
