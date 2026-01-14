import type { ReactNode } from 'react'
import { Select } from '@base-ui/react/select'
import { useEditorContext } from '../../context/editor-context'
import { useFontState } from '../../hooks'

const sizes = [
  { label: 'Size', value: null },
  { label: '10', value: '1' },
  { label: '13', value: '2' },
  { label: '16', value: '3' },
  { label: '18', value: '4' },
  { label: '24', value: '5' },
  { label: '32', value: '6' },
  { label: '48', value: '7' },
]

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
    : null

  return (
    <Select.Root
      items={sizes}
      value={currentValue}
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
          minWidth: 70,
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
              minWidth: 70,
            }}
          >
            <Select.List>
              {sizes.map(({ label, value }) => (
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
