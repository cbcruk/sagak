import { useState, useEffect, useCallback, type ReactNode } from 'preact/compat'
import { AlignLeft, AlignCenter, AlignRight, AlignJustify } from 'lucide-preact'
import { ParagraphEvents, CoreEvents } from 'sagak-core'
import { useEditorContext } from '../../context/editor-context'
import { ToolbarButton } from '../toolbar-button/toolbar-button'

type AlignmentType = 'left' | 'center' | 'right' | 'justify'

const ICON_SIZE = 16

const alignments = [
  { value: 'left', label: 'Align Left', Icon: AlignLeft },
  { value: 'center', label: 'Align Center', Icon: AlignCenter },
  { value: 'right', label: 'Align Right', Icon: AlignRight },
  { value: 'justify', label: 'Justify', Icon: AlignJustify },
] as const

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
    const unsubStyle = eventBus.on(
      CoreEvents.STYLE_CHANGED,
      'after',
      updateAlignment
    )
    const unsubRestore = eventBus.on(
      CoreEvents.CONTENT_RESTORED,
      'after',
      updateAlignment
    )

    return () => {
      document.removeEventListener('selectionchange', updateAlignment)
      unsubStyle()
      unsubRestore()
    }
  }, [eventBus, updateAlignment])

  return (
    <div data-part="icon-button-group" role="group" aria-label="Alignment">
      {alignments.map(({ value, label, Icon }) => (
        <ToolbarButton
          key={value}
          title={label}
          state={currentAlign === value ? 'active' : undefined}
          onClick={() =>
            eventBus.emit(ParagraphEvents.ALIGNMENT_CHANGED, { align: value })
          }
        >
          <Icon size={ICON_SIZE} aria-hidden="true" />
        </ToolbarButton>
      ))}
    </div>
  )
}
