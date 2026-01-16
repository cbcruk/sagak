import type { ReactNode } from 'react'
import { ParagraphEvents } from 'sagak-core'
import { useEditorContext } from '../../context/editor-context'

const buttonStyle: React.CSSProperties = {
  padding: '6px 10px',
  border: '1px solid #ccc',
  borderRadius: 4,
  background: '#fff',
  cursor: 'pointer',
  marginRight: 2,
}

type AlignmentType = 'left' | 'center' | 'right' | 'justify'

export function AlignmentButtons(): ReactNode {
  const editorContext = useEditorContext()

  function handleAlignment(align: AlignmentType): void {
    editorContext.eventBus.emit(ParagraphEvents.ALIGNMENT_CHANGED, { align })
  }

  return (
    <>
      <button
        type="button"
        onClick={() => handleAlignment('left')}
        style={{ ...buttonStyle, textAlign: 'left' }}
        title="Align Left"
      >
        <span style={{ display: 'inline-block', width: 16 }}>
          <span style={{ display: 'block', borderBottom: '2px solid #333', width: '100%', marginBottom: 2 }} />
          <span style={{ display: 'block', borderBottom: '2px solid #333', width: '70%', marginBottom: 2 }} />
          <span style={{ display: 'block', borderBottom: '2px solid #333', width: '100%', marginBottom: 2 }} />
          <span style={{ display: 'block', borderBottom: '2px solid #333', width: '50%' }} />
        </span>
      </button>
      <button
        type="button"
        onClick={() => handleAlignment('center')}
        style={buttonStyle}
        title="Align Center"
      >
        <span style={{ display: 'inline-block', width: 16 }}>
          <span style={{ display: 'block', borderBottom: '2px solid #333', width: '100%', marginBottom: 2, marginLeft: 'auto', marginRight: 'auto' }} />
          <span style={{ display: 'block', borderBottom: '2px solid #333', width: '70%', marginBottom: 2, marginLeft: 'auto', marginRight: 'auto' }} />
          <span style={{ display: 'block', borderBottom: '2px solid #333', width: '100%', marginBottom: 2, marginLeft: 'auto', marginRight: 'auto' }} />
          <span style={{ display: 'block', borderBottom: '2px solid #333', width: '50%', marginLeft: 'auto', marginRight: 'auto' }} />
        </span>
      </button>
      <button
        type="button"
        onClick={() => handleAlignment('right')}
        style={{ ...buttonStyle, textAlign: 'right' }}
        title="Align Right"
      >
        <span style={{ display: 'inline-block', width: 16 }}>
          <span style={{ display: 'block', borderBottom: '2px solid #333', width: '100%', marginBottom: 2, marginLeft: 'auto' }} />
          <span style={{ display: 'block', borderBottom: '2px solid #333', width: '70%', marginBottom: 2, marginLeft: 'auto' }} />
          <span style={{ display: 'block', borderBottom: '2px solid #333', width: '100%', marginBottom: 2, marginLeft: 'auto' }} />
          <span style={{ display: 'block', borderBottom: '2px solid #333', width: '50%', marginLeft: 'auto' }} />
        </span>
      </button>
      <button
        type="button"
        onClick={() => handleAlignment('justify')}
        style={buttonStyle}
        title="Justify"
      >
        <span style={{ display: 'inline-block', width: 16 }}>
          <span style={{ display: 'block', borderBottom: '2px solid #333', width: '100%', marginBottom: 2 }} />
          <span style={{ display: 'block', borderBottom: '2px solid #333', width: '100%', marginBottom: 2 }} />
          <span style={{ display: 'block', borderBottom: '2px solid #333', width: '100%', marginBottom: 2 }} />
          <span style={{ display: 'block', borderBottom: '2px solid #333', width: '100%' }} />
        </span>
      </button>
    </>
  )
}
