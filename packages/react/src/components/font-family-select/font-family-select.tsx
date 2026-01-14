import type { ReactNode } from 'react'
import { Select } from '@base-ui/react/select'
import { useEditorContext } from '../../context/editor-context'
import { useFontState } from '../../hooks'

const fonts = [
  { label: 'Font', value: null },
  { label: 'Arial', value: 'Arial' },
  { label: 'Georgia', value: 'Georgia' },
  { label: 'Times New Roman', value: 'Times New Roman' },
  { label: 'Courier New', value: 'Courier New' },
  { label: 'Verdana', value: 'Verdana' },
]

export function FontFamilySelect(): ReactNode {
  const { selectionManager } = useEditorContext()
  const { fontFamily, setFontFamily } = useFontState()

  const handleOpenChange = (open: boolean): void => {
    if (open) {
      selectionManager?.saveSelection()
    }
  }

  const handleChange = (value: string | null): void => {
    if (value) {
      setFontFamily(value)
    }
  }

  const currentValue = fonts.some((f) => f.value === fontFamily)
    ? fontFamily
    : null

  return (
    <Select.Root
      items={fonts}
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
          minWidth: 120,
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
              minWidth: 120,
            }}
          >
            <Select.List>
              {fonts.map(({ label, value }) => (
                <Select.Item
                  key={label}
                  value={value}
                  style={{
                    padding: '6px 12px',
                    cursor: 'pointer',
                    borderRadius: 2,
                    fontFamily: value ?? undefined,
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
