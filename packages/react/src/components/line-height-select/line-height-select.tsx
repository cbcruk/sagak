import type { ReactNode } from 'react'
import { Select } from '@base-ui/react/select'
import { ChevronDown } from 'lucide-react'
import { FontEvents } from 'sagak-core'
import { useEditorContext } from '../../context/editor-context'

const lineHeights = [
  { label: '1.0', value: '1' },
  { label: '1.15', value: '1.15' },
  { label: '1.5', value: '1.5' },
  { label: '2.0', value: '2' },
  { label: '2.5', value: '2.5' },
  { label: '3.0', value: '3' },
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
  fontSize: 13,
  minWidth: 55,
  justifyContent: 'space-between',
}

const popupStyle: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #d4d4d4',
  borderRadius: 6,
  boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
  padding: 4,
  minWidth: 60,
}

const itemStyle: React.CSSProperties = {
  padding: '6px 12px',
  cursor: 'pointer',
  borderRadius: 4,
  fontSize: 13,
  textAlign: 'center',
}

export function LineHeightSelect(): ReactNode {
  const { eventBus, selectionManager } = useEditorContext()

  const handleOpenChange = (open: boolean): void => {
    if (open) {
      selectionManager?.saveSelection()
    }
  }

  const handleChange = (value: string | null): void => {
    if (value) {
      selectionManager?.restoreSelection()
      eventBus.emit(FontEvents.LINE_HEIGHT_CHANGED, { lineHeight: value })
    }
  }

  return (
    <Select.Root
      items={lineHeights}
      defaultValue="1.5"
      onValueChange={handleChange}
      onOpenChange={handleOpenChange}
    >
      <Select.Trigger style={triggerStyle} title="Line Height">
        <Select.Value />
        <ChevronDown size={14} color="#666" />
      </Select.Trigger>
      <Select.Portal>
        <Select.Positioner sideOffset={4}>
          <Select.Popup style={popupStyle}>
            <Select.List>
              {lineHeights.map(({ label, value }) => (
                <Select.Item
                  key={value}
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
