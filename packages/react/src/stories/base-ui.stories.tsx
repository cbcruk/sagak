import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react'
import { Toggle } from '@base-ui/react/toggle'

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
