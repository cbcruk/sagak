import { useState, useEffect, useCallback, type ReactNode } from 'react'
import { AlignLeft, AlignCenter, AlignRight, AlignJustify } from 'lucide-react'
import { ParagraphEvents, CoreEvents } from 'sagak-core'
import { useEditorContext } from '../../context/editor-context'

type AlignmentType = 'left' | 'center' | 'right' | 'justify'

const ICON_SIZE = 16

const segmentGroupStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  border: '1px solid #d4d4d4',
  borderRadius: 6,
  overflow: 'hidden',
  background: '#fff',
}

function getButtonStyle(isActive: boolean, isLast?: boolean): React.CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 28,
    height: 26,
    border: 'none',
    borderRight: isLast ? 'none' : '1px solid #d4d4d4',
    background: isActive ? '#007AFF' : 'transparent',
    color: isActive ? '#fff' : '#333',
    cursor: 'pointer',
    padding: 0,
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
  const context = useEditorContext()
  const { eventBus } = context
  const [currentAlign, setCurrentAlign] = useState<AlignmentType>('left')

  const isSelectionInEditor = useCallback((): boolean => {
    const element = context.element
    if (!element) return false

    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) return false

    const anchorNode = selection.anchorNode
    if (!anchorNode) return false

    return element.contains(anchorNode)
  }, [context.element])

  const updateAlignment = useCallback((): void => {
    if (!isSelectionInEditor()) return
    setCurrentAlign(getCurrentAlignment())
  }, [isSelectionInEditor])

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
    <div style={segmentGroupStyle}>
      <button
        type="button"
        onClick={() => handleAlignment('left')}
        style={getButtonStyle(currentAlign === 'left')}
        title="Align Left"
      >
        <AlignLeft size={ICON_SIZE} />
      </button>
      <button
        type="button"
        onClick={() => handleAlignment('center')}
        style={getButtonStyle(currentAlign === 'center')}
        title="Align Center"
      >
        <AlignCenter size={ICON_SIZE} />
      </button>
      <button
        type="button"
        onClick={() => handleAlignment('right')}
        style={getButtonStyle(currentAlign === 'right')}
        title="Align Right"
      >
        <AlignRight size={ICON_SIZE} />
      </button>
      <button
        type="button"
        onClick={() => handleAlignment('justify')}
        style={getButtonStyle(currentAlign === 'justify', true)}
        title="Justify"
      >
        <AlignJustify size={ICON_SIZE} />
      </button>
    </div>
  )
}
