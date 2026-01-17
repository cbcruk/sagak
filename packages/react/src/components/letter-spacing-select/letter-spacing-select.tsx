import type { ReactNode } from 'react'
import { Select } from '@base-ui/react/select'
import { ChevronDown } from 'lucide-react'
import { FontEvents } from 'sagak-core'
import { useEditorContext } from '../../context/editor-context'

const letterSpacings = [
  { label: 'Normal', value: '0' },
  { label: '0.05', value: '0.05' },
  { label: '0.1', value: '0.1' },
  { label: '0.15', value: '0.15' },
  { label: '0.2', value: '0.2' },
  { label: '0.3', value: '0.3' },
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
  minWidth: 70,
  justifyContent: 'space-between',
}

const popupStyle: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #d4d4d4',
  borderRadius: 6,
  boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
  padding: 4,
  minWidth: 80,
}

const itemStyle: React.CSSProperties = {
  padding: '6px 12px',
  cursor: 'pointer',
  borderRadius: 4,
  fontSize: 13,
  textAlign: 'center',
}

export function LetterSpacingSelect(): ReactNode {
  const { eventBus, selectionManager } = useEditorContext()

  const handleOpenChange = (open: boolean): void => {
    if (open) {
      selectionManager?.saveSelection()
    }
  }

  const handleChange = (value: string | null): void => {
    if (value) {
      selectionManager?.restoreSelection()
      eventBus.emit(FontEvents.LETTER_SPACING_CHANGED, { letterSpacing: value })
    }
  }

  return (
    <Select.Root
      items={letterSpacings}
      defaultValue="0"
      onValueChange={handleChange}
      onOpenChange={handleOpenChange}
    >
      <Select.Trigger style={triggerStyle} title="Letter Spacing">
        <Select.Value />
        <ChevronDown size={14} color="#666" />
      </Select.Trigger>
      <Select.Portal>
        <Select.Positioner sideOffset={4}>
          <Select.Popup style={popupStyle}>
            <Select.List>
              {letterSpacings.map(({ label, value }) => (
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
