import type { ReactNode } from 'react'
import { Toggle } from '@base-ui/react/toggle'
import { useFormattingState, useHistoryState } from '../../hooks'
import { FontFamilySelect } from '../font-family-select/font-family-select'
import { FontSizeSelect } from '../font-size-select/font-size-select'
import { HeadingSelect } from '../heading-select/heading-select'
import { LinkDialog } from '../link-dialog/link-dialog'
import { ImageDialog } from '../image-dialog/image-dialog'
import { TableDialog } from '../table-dialog/table-dialog'
import { ColorPicker } from '../color-picker/color-picker'
import { AlignmentButtons } from '../alignment-buttons/alignment-buttons'
import { IndentButtons } from '../indent-buttons/indent-buttons'
import { ListButtons } from '../list-buttons/list-buttons'

const buttonStyle = (pressed: boolean): React.CSSProperties => ({
  padding: '6px 12px',
  border: '1px solid #ccc',
  borderRadius: 4,
  background: pressed ? '#333' : '#fff',
  color: pressed ? '#fff' : '#333',
  cursor: 'pointer',
  marginRight: 4,
})

const actionButtonStyle = (disabled: boolean): React.CSSProperties => ({
  padding: '6px 12px',
  border: '1px solid #ccc',
  borderRadius: 4,
  background: '#fff',
  color: disabled ? '#ccc' : '#333',
  cursor: disabled ? 'not-allowed' : 'pointer',
  marginRight: 4,
})

const dividerStyle: React.CSSProperties = {
  width: 1,
  height: 24,
  background: '#ccc',
  margin: '0 8px',
}

export function Toolbar(): ReactNode {
  const {
    isBold,
    isItalic,
    isUnderline,
    isStrikeThrough,
    isSubscript,
    isSuperscript,
    toggleBold,
    toggleItalic,
    toggleUnderline,
    toggleStrikeThrough,
    toggleSubscript,
    toggleSuperscript,
  } = useFormattingState()

  const { canUndo, canRedo, undo, redo } = useHistoryState()

  return (
    <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px 0' }}>
      <button
        type="button"
        onClick={undo}
        disabled={!canUndo}
        style={actionButtonStyle(!canUndo)}
      >
        ↩
      </button>
      <button
        type="button"
        onClick={redo}
        disabled={!canRedo}
        style={actionButtonStyle(!canRedo)}
      >
        ↪
      </button>

      <div style={dividerStyle} />

      <HeadingSelect />
      <FontFamilySelect />
      <FontSizeSelect />

      <div style={dividerStyle} />

      <Toggle
        pressed={isBold}
        onPressedChange={toggleBold}
        style={{ ...buttonStyle(isBold), fontWeight: 'bold' }}
      >
        B
      </Toggle>
      <Toggle
        pressed={isItalic}
        onPressedChange={toggleItalic}
        style={{ ...buttonStyle(isItalic), fontStyle: 'italic' }}
      >
        I
      </Toggle>
      <Toggle
        pressed={isUnderline}
        onPressedChange={toggleUnderline}
        style={{ ...buttonStyle(isUnderline), textDecoration: 'underline' }}
      >
        U
      </Toggle>
      <Toggle
        pressed={isStrikeThrough}
        onPressedChange={toggleStrikeThrough}
        style={{ ...buttonStyle(isStrikeThrough), textDecoration: 'line-through' }}
      >
        S
      </Toggle>
      <Toggle
        pressed={isSubscript}
        onPressedChange={toggleSubscript}
        style={buttonStyle(isSubscript)}
      >
        X<sub>2</sub>
      </Toggle>
      <Toggle
        pressed={isSuperscript}
        onPressedChange={toggleSuperscript}
        style={buttonStyle(isSuperscript)}
      >
        X<sup>2</sup>
      </Toggle>

      <div style={dividerStyle} />

      <ColorPicker type="text" />
      <ColorPicker type="background" label="H" />

      <div style={dividerStyle} />

      <AlignmentButtons />

      <div style={dividerStyle} />

      <IndentButtons />
      <ListButtons />

      <div style={dividerStyle} />

      <LinkDialog />
      <ImageDialog />
      <TableDialog />
    </div>
  )
}
