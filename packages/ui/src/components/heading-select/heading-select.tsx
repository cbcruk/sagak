import type { ComponentChildren } from 'preact'
import { ParagraphEvents } from 'sagak-core'
import { useEditorContext } from '../../context/editor-context'
import { ToolbarSelect } from '../toolbar-select/toolbar-select'

const headings = [
  { label: '¶', value: 'p' },
  { label: 'Heading 1', value: '1' },
  { label: 'Heading 2', value: '2' },
  { label: 'Heading 3', value: '3' },
  { label: 'Heading 4', value: '4' },
  { label: 'Heading 5', value: '5' },
  { label: 'Heading 6', value: '6' },
]

export function HeadingSelect(): ComponentChildren {
  const { eventBus, selectionManager } = useEditorContext()

  const handleSelect = (value: string): void => {
    selectionManager?.restoreSelection()

    if (value === 'p') {
      eventBus.emit(ParagraphEvents.FORMAT_PARAGRAPH)
      return
    }

    eventBus.emit(ParagraphEvents.HEADING_CHANGED, {
      level: parseInt(value, 10),
    })
  }

  return (
    <ToolbarSelect
      title="Paragraph Style"
      options={headings}
      defaultValue="p"
      onSelect={handleSelect}
    />
  )
}
