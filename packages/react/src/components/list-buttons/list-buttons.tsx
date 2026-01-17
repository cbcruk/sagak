import { useState, useEffect, useCallback, type ReactNode } from 'react'
import { ListOrdered, List, ChevronDown } from 'lucide-react'
import { ParagraphEvents, CoreEvents } from 'sagak-core'
import { useEditorContext } from '../../context/editor-context'

type ListType = 'ordered' | 'unordered' | 'none'

const ICON_SIZE = 16

const dropdownButtonStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 2,
  padding: '4px 8px',
  border: '1px solid #d4d4d4',
  borderRadius: 6,
  background: '#fff',
  color: '#333',
  cursor: 'pointer',
  fontSize: 13,
}

const popoverStyle: React.CSSProperties = {
  position: 'absolute',
  top: '100%',
  left: 0,
  marginTop: 4,
  padding: 4,
  background: '#fff',
  border: '1px solid #d4d4d4',
  borderRadius: 6,
  boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
  zIndex: 1000,
  minWidth: 120,
}

const menuItemStyle = (isActive: boolean): React.CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  width: '100%',
  padding: '6px 8px',
  border: 'none',
  borderRadius: 4,
  background: isActive ? '#007AFF' : 'transparent',
  color: isActive ? '#fff' : '#333',
  cursor: 'pointer',
  fontSize: 13,
  textAlign: 'left',
})

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
  const context = useEditorContext()
  const { eventBus } = context
  const [currentList, setCurrentList] = useState<ListType>('none')
  const [isOpen, setIsOpen] = useState(false)

  const isSelectionInEditor = useCallback((): boolean => {
    const element = context.element
    if (!element) return false

    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) return false

    const anchorNode = selection.anchorNode
    if (!anchorNode) return false

    return element.contains(anchorNode)
  }, [context.element])

  const updateListState = useCallback((): void => {
    if (!isSelectionInEditor()) return
    setCurrentList(getCurrentListType())
  }, [isSelectionInEditor])

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

  useEffect(() => {
    function handleClickOutside(event: MouseEvent): void {
      const target = event.target as Element
      if (!target.closest('[data-list-dropdown]')) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  function handleOrderedList(): void {
    eventBus.emit(ParagraphEvents.ORDERED_LIST_CLICKED)
    setIsOpen(false)
  }

  function handleUnorderedList(): void {
    eventBus.emit(ParagraphEvents.UNORDERED_LIST_CLICKED)
    setIsOpen(false)
  }

  const CurrentIcon = currentList === 'ordered' ? ListOrdered : List

  return (
    <div style={{ position: 'relative' }} data-list-dropdown>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          ...dropdownButtonStyle,
          background: currentList !== 'none' ? '#e8f0fe' : '#fff',
        }}
        title="List"
      >
        <CurrentIcon size={ICON_SIZE} />
        <ChevronDown size={12} />
      </button>

      {isOpen && (
        <div style={popoverStyle}>
          <button
            type="button"
            onClick={handleUnorderedList}
            style={menuItemStyle(currentList === 'unordered')}
          >
            <List size={ICON_SIZE} />
            Bullet List
          </button>
          <button
            type="button"
            onClick={handleOrderedList}
            style={menuItemStyle(currentList === 'ordered')}
          >
            <ListOrdered size={ICON_SIZE} />
            Numbered List
          </button>
        </div>
      )}
    </div>
  )
}
