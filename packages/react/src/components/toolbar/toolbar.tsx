import type { ReactNode } from 'react'
import { Toggle } from '@base-ui/react/toggle'
import { useFormattingState, useHistoryState } from '../../hooks'
import { FontFamilySelect } from '../font-family-select/font-family-select'

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
    <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center' }}>
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

      <div style={{ width: 1, height: 24, background: '#ccc', margin: '0 8px' }} />

      <FontFamilySelect />

      <div style={{ width: 1, height: 24, background: '#ccc', margin: '0 8px' }} />

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
    </div>
  )
}
