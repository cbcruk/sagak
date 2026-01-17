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
    <div data-scope="toolbar" data-part="root">
      {/* Undo/Redo */}
      <div style={{ display: 'flex', gap: 4 }}>
        <button
          type="button"
          onClick={undo}
          disabled={!canUndo}
          style={actionButtonStyle(!canUndo)}
          title="Undo (⌘Z)"
        >
          <Undo2 size={ICON_SIZE} />
        </button>
        <button
          type="button"
          onClick={redo}
          disabled={!canRedo}
          style={actionButtonStyle(!canRedo)}
          title="Redo (⌘⇧Z)"
        >
          <Redo2 size={ICON_SIZE} />
        </button>
      </div>

      <div style={dividerStyle} />

      {/* Heading/Paragraph */}
      <HeadingSelect />

      <div style={dividerStyle} />

      {/* Text Style: B I U S */}
      <div style={segmentGroupStyle}>
        <Toggle
          pressed={isBold}
          onPressedChange={toggleBold}
          style={segmentButtonStyle(isBold, true)}
          title="Bold (⌘B)"
        >
          <Bold size={ICON_SIZE} strokeWidth={2.5} />
        </Toggle>
        <Toggle
          pressed={isItalic}
          onPressedChange={toggleItalic}
          style={segmentButtonStyle(isItalic)}
          title="Italic (⌘I)"
        >
          <Italic size={ICON_SIZE} />
        </Toggle>
        <Toggle
          pressed={isUnderline}
          onPressedChange={toggleUnderline}
          style={segmentButtonStyle(isUnderline)}
          title="Underline (⌘U)"
        >
          <Underline size={ICON_SIZE} />
        </Toggle>
        <Toggle
          pressed={isStrikeThrough}
          onPressedChange={toggleStrikeThrough}
          style={segmentButtonStyle(isStrikeThrough, false, true)}
          title="Strikethrough"
        >
          <Strikethrough size={ICON_SIZE} />
        </Toggle>
      </div>

      {/* Colors */}
      <ColorPicker type="text" />
      <ColorPicker type="background" />

      <div style={dividerStyle} />

      {/* Font Family, Size & Line Height */}
      <FontFamilySelect />
      <FontSizeSelect />
      <LineHeightSelect />

      <div style={dividerStyle} />

      {/* Alignment */}
      <AlignmentButtons />

      <div style={dividerStyle} />

      {/* Lists */}
      <ListButtons />

      <div style={dividerStyle} />

      {/* Link, Image, Table, HR */}
      <div style={{ display: 'flex', gap: 4 }}>
        <LinkDialog />
        <ImageDialog />
        <TableDialog />
        <HorizontalRuleButton />
      </div>

      <div style={dividerStyle} />

      {/* Find */}
      <FindReplaceDialog />
    </div>
  )
}
