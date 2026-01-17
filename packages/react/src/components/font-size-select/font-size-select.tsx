import type { ReactNode } from 'react'
import { Select } from '@base-ui/react/select'
import { ChevronDown } from 'lucide-react'
import { useEditorContext } from '../../context/editor-context'
import { useFontState } from '../../hooks'

const sizes = [
  { label: '9', value: '1' },
  { label: '10', value: '1' },
  { label: '11', value: '2' },
  { label: '12', value: '3' },
  { label: '14', value: '4' },
  { label: '18', value: '5' },
  { label: '24', value: '6' },
  { label: '36', value: '7' },
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

export function FontSizeSelect(): ReactNode {
  const { selectionManager } = useEditorContext()
  const { fontSize, setFontSize } = useFontState()

  const handleOpenChange = (open: boolean): void => {
    if (open) {
      selectionManager?.saveSelection()
    }
  }

  const handleChange = (value: string | null): void => {
    if (value) {
      setFontSize(value)
    }
  }

  const currentValue = sizes.some((s) => s.value === fontSize)
    ? fontSize
    : '3'

  return (
    <Select.Root
      items={sizes}
      value={currentValue}
      onValueChange={handleChange}
      onOpenChange={handleOpenChange}
    >
      <Select.Trigger style={triggerStyle} title="Font Size">
        <Select.Value />
        <ChevronDown size={14} color="#666" />
      </Select.Trigger>
      <Select.Portal>
        <Select.Positioner sideOffset={4}>
          <Select.Popup style={popupStyle}>
            <Select.List>
              {sizes.map(({ label, value }) => (
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
