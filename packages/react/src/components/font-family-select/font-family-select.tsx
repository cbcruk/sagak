import type { ReactNode } from 'react'
import { Select } from '@base-ui/react/select'
import { ChevronDown } from 'lucide-react'
import { useEditorContext } from '../../context/editor-context'
import { useFontState } from '../../hooks'

const fonts = [
  { label: 'Helvetica', value: 'Helvetica, Arial, sans-serif' },
  { label: 'Arial', value: 'Arial, sans-serif' },
  { label: 'Georgia', value: 'Georgia, serif' },
  { label: 'Times', value: 'Times New Roman, serif' },
  { label: 'Courier', value: 'Courier New, monospace' },
  { label: 'Verdana', value: 'Verdana, sans-serif' },
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
  minWidth: 90,
  justifyContent: 'space-between',
}

const popupStyle: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #d4d4d4',
  borderRadius: 6,
  boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
  padding: 4,
  minWidth: 140,
}

const itemStyle = (fontFamily?: string): React.CSSProperties => ({
  padding: '6px 12px',
  cursor: 'pointer',
  borderRadius: 4,
  fontSize: 13,
  fontFamily: fontFamily,
})

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
    : fonts[0].value

  return (
    <Select.Root
      items={fonts}
      value={currentValue}
      onValueChange={handleChange}
      onOpenChange={handleOpenChange}
    >
      <Select.Trigger style={triggerStyle} title="Font Family">
        <Select.Value />
        <ChevronDown size={14} color="#666" />
      </Select.Trigger>
      <Select.Portal>
        <Select.Positioner sideOffset={4}>
          <Select.Popup style={popupStyle}>
            <Select.List>
              {fonts.map(({ label, value }) => (
                <Select.Item
                  key={label}
                  value={value}
                  style={itemStyle(value)}
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
