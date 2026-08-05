import type * as React from 'preact/compat'
import type { ReactNode } from 'preact/compat'
import { Toggle, ToggleGroup } from 'kinu'
import {
  Undo2,
  Redo2,
  Bold,
  Italic,
  Underline,
  Strikethrough,
} from 'lucide-preact'
import { useFormattingState, useHistoryState } from '../../hooks'
import { FontFamilySelect } from '../font-family-select/font-family-select'
import { FontSizeSelect } from '../font-size-select/font-size-select'
import { HeadingSelect } from '../heading-select/heading-select'
import { LinkDialog } from '../link-dialog/link-dialog'
import { ImageDialog } from '../image-dialog/image-dialog'
import { TableDialog } from '../table-dialog/table-dialog'
import { ColorPicker } from '../color-picker/color-picker'
import { AlignmentButtons } from '../alignment-buttons/alignment-buttons'
import { ListButtons } from '../list-buttons/list-buttons'
import { FindReplaceDialog } from '../find-replace-dialog/find-replace-dialog'
import { HorizontalRuleButton } from '../horizontal-rule-button/horizontal-rule-button'
import { LineHeightSelect } from '../line-height-select/line-height-select'
import { LetterSpacingSelect } from '../letter-spacing-select/letter-spacing-select'
import { SpecialCharacterDialog } from '../special-character-dialog/special-character-dialog'
import { MoreMenu } from '../more-menu/more-menu'
import { ExportMenu } from '../export-menu/export-menu'
import { ToolbarButton } from '../toolbar-button/toolbar-button'

const ICON_SIZE = 16

/**
 * kinu 의 `ToggleGroup` 이 이어붙인 모서리와 눌림 상태를 담당합니다.
 * 아이콘 버튼이라 크기만 정사각형에 가깝게 맞춥니다.
 */
const segmentButtonStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 28,
  height: 26,
  padding: 0,
}



export function Toolbar(): ReactNode {
  const {
    isBold,
    isItalic,
    isUnderline,
    isStrikeThrough,
    toggleBold,
    toggleItalic,
    toggleUnderline,
    toggleStrikeThrough,
  } = useFormattingState()

  const { canUndo, canRedo, undo, redo } = useHistoryState()

  return (
    <div data-scope="toolbar" data-part="root" role="toolbar" aria-label="Text formatting">
      {/* Undo/Redo */}
      <div data-part="icon-button-group" role="group" aria-label="History">
        <ToolbarButton title="Undo (⌘Z)" aria-label="Undo" onClick={undo} disabled={!canUndo}>
          <Undo2 size={ICON_SIZE} aria-hidden="true" />
        </ToolbarButton>
        <ToolbarButton title="Redo (⌘⇧Z)" aria-label="Redo" onClick={redo} disabled={!canRedo}>
          <Redo2 size={ICON_SIZE} aria-hidden="true" />
        </ToolbarButton>
      </div>

      <div data-part="separator" />

      {/* Heading/Paragraph */}
      <HeadingSelect />

      <div data-part="separator" />

      {/* Text Style: B I U S */}
      <ToggleGroup role="group" aria-label="Text style">
        <Toggle
          pressed={isBold}
          onClick={toggleBold}
          style={segmentButtonStyle}
          title="Bold (⌘B)"
          aria-label="Bold"
        >
          <Bold size={ICON_SIZE} strokeWidth={2.5} aria-hidden="true" />
        </Toggle>
        <Toggle
          pressed={isItalic}
          onClick={toggleItalic}
          style={segmentButtonStyle}
          title="Italic (⌘I)"
          aria-label="Italic"
        >
          <Italic size={ICON_SIZE} aria-hidden="true" />
        </Toggle>
        <Toggle
          pressed={isUnderline}
          onClick={toggleUnderline}
          style={segmentButtonStyle}
          title="Underline (⌘U)"
          aria-label="Underline"
        >
          <Underline size={ICON_SIZE} aria-hidden="true" />
        </Toggle>
        <Toggle
          pressed={isStrikeThrough}
          onClick={toggleStrikeThrough}
          style={segmentButtonStyle}
          title="Strikethrough"
          aria-label="Strikethrough"
        >
          <Strikethrough size={ICON_SIZE} aria-hidden="true" />
        </Toggle>
      </ToggleGroup>

      {/* Colors */}
      <ColorPicker type="text" />
      <ColorPicker type="background" />

      <div data-part="separator" />

      {/* Font Family, Size - always visible */}
      <FontFamilySelect />
      <FontSizeSelect />

      {/* Line Height & Letter Spacing - hidden on mobile */}
      <div data-part="mobile-hidden" style={{ display: 'contents' }}>
        <LineHeightSelect />
        <LetterSpacingSelect />
      </div>

      <div data-part="separator" />

      {/* Alignment */}
      <AlignmentButtons />

      <div data-part="separator" />

      {/* Lists */}
      <ListButtons />

      {/* Link, Image, Table, HR, Special Characters - hidden on mobile */}
      <div data-part="mobile-hidden" style={{ display: 'contents' }}>
        <div data-part="separator" />
        <div style={{ display: 'flex', gap: 4 }}>
          <LinkDialog />
          <ImageDialog />
          <TableDialog />
          <HorizontalRuleButton />
          <SpecialCharacterDialog />
        </div>

        <div data-part="separator" />

        {/* Find & Export */}
        <div style={{ display: 'flex', gap: 4 }}>
          <FindReplaceDialog />
          <ExportMenu />
        </div>
      </div>

      {/* More Menu - visible on mobile */}
      <MoreMenu />
    </div>
  )
}
