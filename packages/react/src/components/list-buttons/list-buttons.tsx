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

export function ListButtons(): ReactNode {
  const editorContext = useEditorContext()

  function handleOrderedList(): void {
    editorContext.eventBus.emit(ParagraphEvents.ORDERED_LIST_CLICKED)
  }

  function handleUnorderedList(): void {
    editorContext.eventBus.emit(ParagraphEvents.UNORDERED_LIST_CLICKED)
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOrderedList}
        style={buttonStyle}
        title="Ordered List"
      >
        <span style={{ display: 'inline-block', width: 16, fontSize: 10, lineHeight: 1.2 }}>
          <span style={{ display: 'block' }}>1.</span>
          <span style={{ display: 'block' }}>2.</span>
          <span style={{ display: 'block' }}>3.</span>
        </span>
      </button>
      <button
        type="button"
        onClick={handleUnorderedList}
        style={buttonStyle}
        title="Unordered List"
      >
        <span style={{ display: 'inline-block', width: 16, fontSize: 10, lineHeight: 1.2 }}>
          <span style={{ display: 'block' }}>&bull;</span>
          <span style={{ display: 'block' }}>&bull;</span>
          <span style={{ display: 'block' }}>&bull;</span>
        </span>
      </button>
    </>
  )
}
