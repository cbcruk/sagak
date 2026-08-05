import type { ComponentChildren } from 'preact'
import { FontEvents } from 'sagak-core'
import { useEditorContext } from '../../context/editor-context'
import { ToolbarSelect } from '../toolbar-select/toolbar-select'

const letterSpacings = [
  { label: 'Normal', value: '0' },
  { label: '0.05', value: '0.05' },
  { label: '0.1', value: '0.1' },
  { label: '0.15', value: '0.15' },
  { label: '0.2', value: '0.2' },
  { label: '0.3', value: '0.3' },
]

export function LetterSpacingSelect(): ComponentChildren {
  const { eventBus, selectionManager } = useEditorContext()

  const handleSelect = (letterSpacing: string): void => {
    selectionManager?.restoreSelection()
    eventBus.emit(FontEvents.LETTER_SPACING_CHANGED, { letterSpacing })
  }

  return (
    <ToolbarSelect
      title="Letter Spacing"
      options={letterSpacings}
      defaultValue="0"
      onSelect={handleSelect}
    />
  )
}
