import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Toggle } from '@base-ui/react/toggle'
import { Select } from '@base-ui/react/select'

function ToggleDemo(): React.ReactNode {
  const [pressed, setPressed] = useState(false)

  return (
    <div style={{ padding: 20 }}>
      <h3>Base UI Toggle Test</h3>
      <Toggle
        pressed={pressed}
        onPressedChange={setPressed}
        style={{
          padding: '8px 16px',
          border: '1px solid #ccc',
          borderRadius: 4,
          background: pressed ? '#333' : '#fff',
          color: pressed ? '#fff' : '#333',
          cursor: 'pointer',
        }}
      >
        <strong>B</strong>
      </Toggle>
      <p style={{ marginTop: 16 }}>
        State: {pressed ? 'Pressed' : 'Not pressed'}
      </p>
    </div>
  )
}

const meta: Meta = {
  title: 'Base UI/Toggle',
  component: ToggleDemo,
}

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

const FONTS = [
  { value: 'Arial', label: 'Arial' },
  { value: 'Georgia', label: 'Georgia' },
  { value: 'Times New Roman', label: 'Times New Roman' },
]

function SelectDemo(): React.ReactNode {
  const [selected, setSelected] = useState<string | null>('Arial')

  const handleChange = (value: string | null): void => {
    console.log('[SelectDemo] onValueChange:', value)
    setSelected(value)
  }

  return (
    <div style={{ padding: 20 }}>
      <h3>Base UI Select Test</h3>
      <Select.Root value={selected} onValueChange={handleChange}>
        <Select.Trigger
          style={{
            padding: '8px 16px',
            border: '1px solid #ccc',
            borderRadius: 4,
            background: '#fff',
            cursor: 'pointer',
            minWidth: 150,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Select.Value />
          <Select.Icon>▼</Select.Icon>
        </Select.Trigger>
        <Select.Portal>
          <Select.Positioner>
            <Select.Popup
              style={{
                background: '#fff',
                border: '1px solid #ccc',
                borderRadius: 4,
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                padding: 4,
                minWidth: 150,
              }}
            >
              {FONTS.map((font) => (
                <Select.Item
                  key={font.value}
                  value={font.value}
                  style={{
                    padding: '8px 12px',
                    cursor: 'pointer',
                    borderRadius: 2,
                    fontFamily: font.value,
                  }}
                >
                  <Select.ItemText>{font.label}</Select.ItemText>
                </Select.Item>
              ))}
            </Select.Popup>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>
      <p style={{ marginTop: 16 }}>Selected: {selected}</p>
    </div>
  )
}

export const SelectTest: Story = {
  render: () => <SelectDemo />,
}
