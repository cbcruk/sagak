import type { ReactNode } from 'react'
import { Minus } from 'lucide-react'
import { ContentEvents } from 'sagak-core'
import { useEditorContext } from '../../context/editor-context'

const ICON_SIZE = 16

const buttonStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 28,
  height: 26,
  border: '1px solid #d4d4d4',
  borderRadius: 6,
  background: '#fff',
  color: '#333',
  cursor: 'pointer',
}

export function HorizontalRuleButton(): ReactNode {
  const { eventBus } = useEditorContext()

  const handleClick = (): void => {
    eventBus.emit(ContentEvents.HORIZONTAL_RULE_INSERT)
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      style={buttonStyle}
      title="Insert Horizontal Rule"
    >
      <Minus size={ICON_SIZE} />
    </button>
  )
}
