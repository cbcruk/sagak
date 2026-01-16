import { useState, useEffect, useCallback, type ReactNode } from 'react'
import { ParagraphEvents, CoreEvents } from 'sagak-core'
import { useEditorContext } from '../../context/editor-context'

type AlignmentType = 'left' | 'center' | 'right' | 'justify'

function getButtonStyle(isActive: boolean): React.CSSProperties {
  return {
    padding: '6px 10px',
    border: '1px solid #ccc',
    borderRadius: 4,
    background: isActive ? '#333' : '#fff',
    color: isActive ? '#fff' : '#333',
    cursor: 'pointer',
    marginRight: 2,
  }
}

function getCurrentAlignment(): AlignmentType {
  const selection = window.getSelection()
  if (!selection || !selection.anchorNode) return 'left'

  let node: Node | null = selection.anchorNode

  while (node && node !== document.body) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as HTMLElement
      const textAlign = window.getComputedStyle(element).textAlign

      if (textAlign === 'center') return 'center'
      if (textAlign === 'right') return 'right'
      if (textAlign === 'justify') return 'justify'
      if (textAlign === 'start' || textAlign === 'left') return 'left'
    }
    node = node.parentNode
  }

  return 'left'
}

export function AlignmentButtons(): ReactNode {
  const { eventBus } = useEditorContext()
  const [currentAlign, setCurrentAlign] = useState<AlignmentType>('left')

  const updateAlignment = useCallback((): void => {
    setCurrentAlign(getCurrentAlignment())
  }, [])

  useEffect(() => {
    document.addEventListener('selectionchange', updateAlignment)
    const unsubStyle = eventBus.on(CoreEvents.STYLE_CHANGED, 'after', updateAlignment)
    const unsubRestore = eventBus.on(CoreEvents.CONTENT_RESTORED, 'after', updateAlignment)

    return () => {
      document.removeEventListener('selectionchange', updateAlignment)
      unsubStyle()
      unsubRestore()
    }
  }, [eventBus, updateAlignment])

  function handleAlignment(align: AlignmentType): void {
    eventBus.emit(ParagraphEvents.ALIGNMENT_CHANGED, { align })
  }

  return (
    <>
      <button
        type="button"
        onClick={() => handleAlignment('left')}
        style={getButtonStyle(currentAlign === 'left')}
        title="Align Left"
      >
        <span style={{ display: 'inline-block', width: 16 }}>
          <span style={{ display: 'block', borderBottom: '2px solid currentColor', width: '100%', marginBottom: 2 }} />
          <span style={{ display: 'block', borderBottom: '2px solid currentColor', width: '70%', marginBottom: 2 }} />
          <span style={{ display: 'block', borderBottom: '2px solid currentColor', width: '100%', marginBottom: 2 }} />
          <span style={{ display: 'block', borderBottom: '2px solid currentColor', width: '50%' }} />
        </span>
      </button>
      <button
        type="button"
        onClick={() => handleAlignment('center')}
        style={getButtonStyle(currentAlign === 'center')}
        title="Align Center"
      >
        <span style={{ display: 'inline-block', width: 16 }}>
          <span style={{ display: 'block', borderBottom: '2px solid currentColor', width: '100%', marginBottom: 2, marginLeft: 'auto', marginRight: 'auto' }} />
          <span style={{ display: 'block', borderBottom: '2px solid currentColor', width: '70%', marginBottom: 2, marginLeft: 'auto', marginRight: 'auto' }} />
          <span style={{ display: 'block', borderBottom: '2px solid currentColor', width: '100%', marginBottom: 2, marginLeft: 'auto', marginRight: 'auto' }} />
          <span style={{ display: 'block', borderBottom: '2px solid currentColor', width: '50%', marginLeft: 'auto', marginRight: 'auto' }} />
        </span>
      </button>
      <button
        type="button"
        onClick={() => handleAlignment('right')}
        style={getButtonStyle(currentAlign === 'right')}
        title="Align Right"
      >
        <span style={{ display: 'inline-block', width: 16 }}>
          <span style={{ display: 'block', borderBottom: '2px solid currentColor', width: '100%', marginBottom: 2, marginLeft: 'auto' }} />
          <span style={{ display: 'block', borderBottom: '2px solid currentColor', width: '70%', marginBottom: 2, marginLeft: 'auto' }} />
          <span style={{ display: 'block', borderBottom: '2px solid currentColor', width: '100%', marginBottom: 2, marginLeft: 'auto' }} />
          <span style={{ display: 'block', borderBottom: '2px solid currentColor', width: '50%', marginLeft: 'auto' }} />
        </span>
      </button>
      <button
        type="button"
        onClick={() => handleAlignment('justify')}
        style={getButtonStyle(currentAlign === 'justify')}
        title="Justify"
      >
        <span style={{ display: 'inline-block', width: 16 }}>
          <span style={{ display: 'block', borderBottom: '2px solid currentColor', width: '100%', marginBottom: 2 }} />
          <span style={{ display: 'block', borderBottom: '2px solid currentColor', width: '100%', marginBottom: 2 }} />
          <span style={{ display: 'block', borderBottom: '2px solid currentColor', width: '100%', marginBottom: 2 }} />
          <span style={{ display: 'block', borderBottom: '2px solid currentColor', width: '100%' }} />
        </span>
      </button>
    </>
  )
}
