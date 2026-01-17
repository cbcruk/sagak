import type { Meta, StoryObj } from '@storybook/react'
import { useEditor } from '../hooks'
import { EditorProvider } from '../context/editor-context'
import { Toolbar, EditorContainer } from '../components'
import '../styles/index.css'

function BasicEditor(): React.ReactNode {
  const { containerRef, editor, ready, error } = useEditor({
    initialContent: '<p>Hello, Sagak Editor!</p>',
  })

  return (
    <div style={{ padding: 20 }}>
      {error && <div style={{ color: 'red', padding: 16 }}>Error: {error.message}</div>}
      <EditorContainer>
        {ready && editor ? (
          <EditorProvider context={editor.context}>
            <Toolbar />
          </EditorProvider>
        ) : null}
        <div
          ref={containerRef}
          data-scope="editing-area"
          data-part="wysiwyg"
        />
      </EditorContainer>
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
