import type { ComponentChildren } from 'preact'
import { AlignLeft, AlignCenter, AlignRight, AlignJustify } from 'lucide-preact'
import { ParagraphEvents } from 'sagak-core'
import { useEditorContext } from '../../context/editor-context'
import { useSelectionDerived } from '../../hooks/use-selection-derived'
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

export function AlignmentButtons(): ComponentChildren {
  const { eventBus } = useEditorContext()
  const currentAlign = useSelectionDerived<AlignmentType>(
    getCurrentAlignment,
    'left'
  )

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
