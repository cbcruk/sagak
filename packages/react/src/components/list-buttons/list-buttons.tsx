import { useState, useEffect, useCallback, type ReactNode } from 'react'
import { ParagraphEvents, CoreEvents } from 'sagak-core'
import { useEditorContext } from '../../context/editor-context'

type ListType = 'ordered' | 'unordered' | 'none'

function getButtonStyle(isActive: boolean): React.CSSProperties {
  return {
    padding: '6px 10px',
    border: '1px solid #ccc',
    borderRadius: 4,
    background: isActive ? '#333' : '#fff',
    color: isActive ? '#fff' : '#333',
    cursor: 'pointer',
    marginRight: 4,
  }
}

function getCurrentListType(): ListType {
  const selection = window.getSelection()
  if (!selection || !selection.anchorNode) return 'none'

  let node: Node | null = selection.anchorNode

  while (node && node !== document.body) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const tagName = (node as Element).tagName
      if (tagName === 'OL') return 'ordered'
      if (tagName === 'UL') return 'unordered'
    }
    node = node.parentNode
  }

  return 'none'
}

export function ListButtons(): ReactNode {
  const { eventBus } = useEditorContext()
  const [currentList, setCurrentList] = useState<ListType>('none')

  const updateListState = useCallback((): void => {
    setCurrentList(getCurrentListType())
  }, [])

  useEffect(() => {
    document.addEventListener('selectionchange', updateListState)
    const unsubStyle = eventBus.on(CoreEvents.STYLE_CHANGED, 'after', updateListState)
    const unsubRestore = eventBus.on(CoreEvents.CONTENT_RESTORED, 'after', updateListState)

    return () => {
      document.removeEventListener('selectionchange', updateListState)
      unsubStyle()
      unsubRestore()
    }
  }, [eventBus, updateListState])

  function handleOrderedList(): void {
    eventBus.emit(ParagraphEvents.ORDERED_LIST_CLICKED)
  }

  function handleUnorderedList(): void {
    eventBus.emit(ParagraphEvents.UNORDERED_LIST_CLICKED)
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOrderedList}
        style={getButtonStyle(currentList === 'ordered')}
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
        style={getButtonStyle(currentList === 'unordered')}
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
