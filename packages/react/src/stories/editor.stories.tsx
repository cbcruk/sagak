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

const longContent = `
<h1>Scrollbar Test</h1>
<p>This is a test to demonstrate the custom scrollbar styling.</p>
<p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.</p>
<h2>Section 1</h2>
<p>Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.</p>
<ul>
  <li>Item 1</li>
  <li>Item 2</li>
  <li>Item 3</li>
</ul>
<h2>Section 2</h2>
<p>Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.</p>
<ol>
  <li>First item</li>
  <li>Second item</li>
  <li>Third item</li>
</ol>
<h2>Section 3</h2>
<p>Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.</p>
<p>Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium.</p>
<h2>Section 4</h2>
<p>Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit.</p>
<p>Neque porro quisquam est, qui dolorem ipsum quia dolor sit amet, consectetur, adipisci velit.</p>
`.trim()

function ScrollbarTestEditor(): React.ReactNode {
  const { containerRef, editor, ready, error } = useEditor({
    initialContent: longContent,
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
          style={{ maxHeight: 200, overflowY: 'auto' }}
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

export const ScrollbarTest: Story = {
  render: () => <ScrollbarTestEditor />,
}

export const ColorPickerTest: Story = {
  render: () => <BasicEditor />,
  parameters: {
    docs: {
      description: {
        story: 'Test the ColorPicker with recent colors. Select a few colors and they will appear in the "Recent" section at the top of the color picker.',
      },
    },
  },
}
