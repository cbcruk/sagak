import type { ReactNode } from 'react'
import { ParagraphEvents } from 'sagak-core'
import { useEditorContext } from '../../context/editor-context'

const buttonStyle: React.CSSProperties = {
  padding: '6px 10px',
  border: '1px solid #ccc',
  borderRadius: 4,
  background: '#fff',
  cursor: 'pointer',
  marginRight: 4,
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
        <span style={{ display: 'inline-block', width: 16 }}>
          <span style={{ display: 'block', borderBottom: '2px solid #333', width: '100%', marginBottom: 2 }} />
          <span style={{ display: 'flex', alignItems: 'center', marginBottom: 2 }}>
            <span style={{ marginRight: 2 }}>&larr;</span>
            <span style={{ flex: 1, borderBottom: '2px solid #333' }} />
          </span>
          <span style={{ display: 'block', borderBottom: '2px solid #333', width: '100%' }} />
        </span>
      </button>
      <button
        type="button"
        onClick={handleIndent}
        style={buttonStyle}
        title="Increase Indent"
      >
        <span style={{ display: 'inline-block', width: 16 }}>
          <span style={{ display: 'block', borderBottom: '2px solid #333', width: '100%', marginBottom: 2 }} />
          <span style={{ display: 'flex', alignItems: 'center', marginBottom: 2 }}>
            <span style={{ marginRight: 2 }}>&rarr;</span>
            <span style={{ flex: 1, borderBottom: '2px solid #333' }} />
          </span>
          <span style={{ display: 'block', borderBottom: '2px solid #333', width: '100%' }} />
        </span>
      </button>
    </>
  )
}
