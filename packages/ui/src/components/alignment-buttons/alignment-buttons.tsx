import type { ComponentChildren } from 'preact'
import { AlignLeft, AlignCenter, AlignRight, AlignJustify } from 'lucide-preact'
import { ParagraphEvents } from 'sagak-core'
import { useEditorContext } from '../../context/editor-context'
import { useSelectionDerived } from '../../hooks/use-selection-derived'
import { ToolbarButton } from '../toolbar-button/toolbar-button'
import {
  getCurrentAlignment,
  type AlignmentType,
} from './alignment-buttons.shared'

const ICON_SIZE = 16

const alignments = [
  { value: 'left', label: 'Align Left', Icon: AlignLeft },
  { value: 'center', label: 'Align Center', Icon: AlignCenter },
  { value: 'right', label: 'Align Right', Icon: AlignRight },
  { value: 'justify', label: 'Justify', Icon: AlignJustify },
] as const

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
