import type { ReactNode } from 'react'
import { IndentDecrease, IndentIncrease } from 'lucide-react'
import { ParagraphEvents } from 'sagak-core'
import { useEditorContext } from '../../context/editor-context'

const ICON_SIZE = 18

const buttonStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 32,
  height: 32,
  border: 'none',
  borderRadius: 4,
  background: 'transparent',
  color: '#333',
  cursor: 'pointer',
}

export function IndentButtons(): ReactNode {
  const editorContext = useEditorContext()

  function handleIndent(): void {
    editorContext.eventBus.emit(ParagraphEvents.INDENT_CLICKED)
  }

  function handleOutdent(): void {
    editorContext.eventBus.emit(ParagraphEvents.OUTDENT_CLICKED)
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOutdent}
        style={buttonStyle}
        title="Decrease Indent"
      >
        <IndentDecrease size={ICON_SIZE} />
      </button>
      <button
        type="button"
        onClick={handleIndent}
        style={buttonStyle}
        title="Increase Indent"
      >
        <IndentIncrease size={ICON_SIZE} />
      </button>
    </>
  )
}
