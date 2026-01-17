import type { ReactNode } from 'react'
import { Select } from '@base-ui/react/select'
import { ChevronDown } from 'lucide-react'
import { ParagraphEvents } from 'sagak-core'
import { useEditorContext } from '../../context/editor-context'

const headings = [
  { label: '¶', value: 'p', displayLabel: '¶' },
  { label: 'Heading 1', value: '1', displayLabel: 'H1' },
  { label: 'Heading 2', value: '2', displayLabel: 'H2' },
  { label: 'Heading 3', value: '3', displayLabel: 'H3' },
  { label: 'Heading 4', value: '4', displayLabel: 'H4' },
  { label: 'Heading 5', value: '5', displayLabel: 'H5' },
  { label: 'Heading 6', value: '6', displayLabel: 'H6' },
]

const triggerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  padding: '4px 8px',
  border: '1px solid #d4d4d4',
  borderRadius: 6,
  background: '#fff',
  cursor: 'pointer',
  fontSize: 14,
  minWidth: 50,
  justifyContent: 'space-between',
}

const popupStyle: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #d4d4d4',
  borderRadius: 6,
  boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
  padding: 4,
  minWidth: 120,
}

const itemStyle: React.CSSProperties = {
  padding: '6px 12px',
  cursor: 'pointer',
  borderRadius: 4,
  fontSize: 13,
}

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
      <Select.Trigger style={triggerStyle} title="Paragraph Style">
        <Select.Value />
        <ChevronDown size={14} color="#666" />
      </Select.Trigger>
      <Select.Portal>
        <Select.Positioner sideOffset={4}>
          <Select.Popup style={popupStyle}>
            <Select.List>
              {headings.map(({ label, value }) => (
                <Select.Item
                  key={label}
                  value={value}
                  style={itemStyle}
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
