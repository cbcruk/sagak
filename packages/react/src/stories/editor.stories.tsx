import type { Meta, StoryObj } from '@storybook/react'
import { useEditor } from '../hooks'
import { EditorProvider } from '../context/editor-context'
import '../styles/index.css'

function BasicEditor(): React.ReactNode {
  const { containerRef, editor, ready, error } = useEditor({
    initialContent: '<p>Hello, Sagak Editor!</p>',
  })

  return (
    <div>
      {error && <div style={{ color: 'red', padding: 16 }}>Error: {error.message}</div>}
      {ready && editor ? (
        <EditorProvider context={editor.context}>
          <div style={{ padding: 8, background: '#f0f0f0' }}>Editor Ready</div>
        </EditorProvider>
      ) : null}
      <div
        ref={containerRef}
        style={{
          border: '1px solid #ccc',
          minHeight: 300,
        }}
      />
    </div>
  )
}

const meta: Meta = {
  title: 'Editor/Basic',
  component: BasicEditor,
}

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}
