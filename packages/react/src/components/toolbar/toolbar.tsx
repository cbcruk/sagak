import type { ReactNode } from 'react'
import { Toggle } from '@base-ui/react/toggle'
import {
  Undo2,
  Redo2,
  Bold,
  Italic,
  Underline,
  Strikethrough,
} from 'lucide-react'
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

const ICON_SIZE = 16

const segmentGroupStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
}

const segmentButtonStyle = (isActive: boolean, isFirst?: boolean, isLast?: boolean): React.CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 28,
  height: 26,
  border: '1px solid #d4d4d4',
  borderLeft: isFirst ? '1px solid #d4d4d4' : 'none',
  borderRadius: isFirst ? '6px 0 0 6px' : isLast ? '0 6px 6px 0' : 0,
  background: isActive ? '#007AFF' : '#fff',
  color: isActive ? '#fff' : '#333',
  cursor: 'pointer',
  padding: 0,
})

const actionButtonStyle = (disabled: boolean): React.CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 28,
  height: 26,
  border: '1px solid #d4d4d4',
  borderRadius: 6,
  background: '#fff',
  color: disabled ? '#ccc' : '#333',
  cursor: disabled ? 'not-allowed' : 'pointer',
})

const dividerStyle: React.CSSProperties = {
  width: 1,
  height: 20,
  background: '#e5e5e5',
  margin: '0 4px',
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
      <div style={{ display: 'flex', gap: 4 }} role="group" aria-label="History">
        <button
          type="button"
          onClick={undo}
          disabled={!canUndo}
          style={actionButtonStyle(!canUndo)}
          title="Undo (⌘Z)"
          aria-label="Undo"
          aria-disabled={!canUndo}
        >
          <Undo2 size={ICON_SIZE} aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={redo}
          disabled={!canRedo}
          style={actionButtonStyle(!canRedo)}
          title="Redo (⌘⇧Z)"
          aria-label="Redo"
          aria-disabled={!canRedo}
        >
          <Redo2 size={ICON_SIZE} aria-hidden="true" />
        </button>
      </div>

      <div style={dividerStyle} data-part="separator" />

      {/* Heading/Paragraph */}
      <HeadingSelect />

      <div style={dividerStyle} data-part="separator" />

      {/* Text Style: B I U S */}
      <div style={segmentGroupStyle} role="group" aria-label="Text style">
        <Toggle
          pressed={isBold}
          onPressedChange={toggleBold}
          style={segmentButtonStyle(isBold, true)}
          title="Bold (⌘B)"
          aria-label="Bold"
          aria-pressed={isBold}
        >
          <Bold size={ICON_SIZE} strokeWidth={2.5} aria-hidden="true" />
        </Toggle>
        <Toggle
          pressed={isItalic}
          onPressedChange={toggleItalic}
          style={segmentButtonStyle(isItalic)}
          title="Italic (⌘I)"
          aria-label="Italic"
          aria-pressed={isItalic}
        >
          <Italic size={ICON_SIZE} aria-hidden="true" />
        </Toggle>
        <Toggle
          pressed={isUnderline}
          onPressedChange={toggleUnderline}
          style={segmentButtonStyle(isUnderline)}
          title="Underline (⌘U)"
          aria-label="Underline"
          aria-pressed={isUnderline}
        >
          <Underline size={ICON_SIZE} aria-hidden="true" />
        </Toggle>
        <Toggle
          pressed={isStrikeThrough}
          onPressedChange={toggleStrikeThrough}
          style={segmentButtonStyle(isStrikeThrough, false, true)}
          title="Strikethrough"
          aria-label="Strikethrough"
          aria-pressed={isStrikeThrough}
        >
          <Strikethrough size={ICON_SIZE} aria-hidden="true" />
        </Toggle>
      </div>

      {/* Colors */}
      <ColorPicker type="text" />
      <ColorPicker type="background" />

      <div style={dividerStyle} data-part="separator" />

      {/* Font Family, Size - always visible */}
      <FontFamilySelect />
      <FontSizeSelect />

      {/* Line Height & Letter Spacing - hidden on mobile */}
      <div data-part="mobile-hidden" style={{ display: 'contents' }}>
        <LineHeightSelect />
        <LetterSpacingSelect />
      </div>

      <div style={dividerStyle} data-part="separator" />

      {/* Alignment */}
      <AlignmentButtons />

      <div style={dividerStyle} data-part="separator" />

      {/* Lists */}
      <ListButtons />

      {/* Link, Image, Table, HR, Special Characters - hidden on mobile */}
      <div data-part="mobile-hidden" style={{ display: 'contents' }}>
        <div style={dividerStyle} data-part="separator" />
        <div style={{ display: 'flex', gap: 4 }}>
          <LinkDialog />
          <ImageDialog />
          <TableDialog />
          <HorizontalRuleButton />
          <SpecialCharacterDialog />
        </div>

        <div style={dividerStyle} data-part="separator" />

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
