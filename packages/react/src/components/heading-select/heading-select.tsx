import type { ReactNode } from 'react'
import { Select } from '@base-ui/react/select'
import { ParagraphEvents } from 'sagak-core'
import { useEditorContext } from '../../context/editor-context'

const headings = [
  { label: 'Paragraph', value: 'p' },
  { label: 'Heading 1', value: '1' },
  { label: 'Heading 2', value: '2' },
  { label: 'Heading 3', value: '3' },
  { label: 'Heading 4', value: '4' },
  { label: 'Heading 5', value: '5' },
  { label: 'Heading 6', value: '6' },
]

export function HeadingSelect(): ReactNode {
  const { eventBus, selectionManager } = useEditorContext()

  const handleOpenChange = (open: boolean): void => {
    if (open) {
      selectionManager?.saveSelection()
    }
  }

  const handleChange = (value: string | null): void => {
    if (!value) return

    selectionManager?.restoreSelection()

    if (value === 'p') {
      eventBus.emit(ParagraphEvents.FORMAT_PARAGRAPH)
    } else {
      const level = parseInt(value, 10)
      eventBus.emit(ParagraphEvents.HEADING_CHANGED, { level })
    }
  }

  return (
    <Select.Root
      items={headings}
      defaultValue="p"
      onValueChange={handleChange}
      onOpenChange={handleOpenChange}
    >
      <Select.Trigger
        style={{
          padding: '6px 12px',
          border: '1px solid #ccc',
          borderRadius: 4,
          background: '#fff',
          cursor: 'pointer',
          marginRight: 4,
          minWidth: 100,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Select.Value />
        <Select.Icon>▼</Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Positioner sideOffset={4}>
          <Select.Popup
            style={{
              background: '#fff',
              border: '1px solid #ccc',
              borderRadius: 4,
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              padding: 4,
              minWidth: 100,
            }}
          >
            <Select.List>
              {headings.map(({ label, value }) => (
                <Select.Item
                  key={label}
                  value={value}
                  style={{
                    padding: '6px 12px',
                    cursor: 'pointer',
                    borderRadius: 2,
                  }}
                >
                  <Select.ItemText>{label}</Select.ItemText>
                </Select.Item>
              ))}
            </Select.List>
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  )
}
