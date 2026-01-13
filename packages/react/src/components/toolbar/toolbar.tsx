import type { ReactNode } from 'react'
import { Toggle } from '@base-ui/react/toggle'
import { useFormattingState } from '../../hooks'

const buttonStyle = (pressed: boolean): React.CSSProperties => ({
  padding: '6px 12px',
  border: '1px solid #ccc',
  borderRadius: 4,
  background: pressed ? '#333' : '#fff',
  color: pressed ? '#fff' : '#333',
  cursor: 'pointer',
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

  return (
    <div style={{ marginBottom: 8, display: 'flex' }}>
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
