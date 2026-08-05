import type { ComponentChildren } from 'preact'
import { FontEvents } from 'sagak-core'
import { useEditorContext } from '../../context/editor-context'
import { ToolbarSelect } from '../toolbar-select/toolbar-select'

const lineHeights = [
  { label: '1.0', value: '1' },
  { label: '1.15', value: '1.15' },
  { label: '1.5', value: '1.5' },
  { label: '2.0', value: '2' },
  { label: '2.5', value: '2.5' },
  { label: '3.0', value: '3' },
]

export function LineHeightSelect(): ComponentChildren {
  const { eventBus, selectionManager } = useEditorContext()

  const handleSelect = (lineHeight: string): void => {
    selectionManager?.restoreSelection()
    eventBus.emit(FontEvents.LINE_HEIGHT_CHANGED, { lineHeight })
  }

  return (
    <ToolbarSelect
      title="Line Height"
      options={lineHeights}
      defaultValue="1.5"
      onSelect={handleSelect}
    />
  )
}
