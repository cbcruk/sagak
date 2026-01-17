import type { Meta, StoryObj } from '@storybook/react'
import { useEditor } from '../hooks'
import { EditorProvider } from '../context/editor-context'
import { Toolbar, EditorContainer, AutocompletePopover, AutoSaveIndicator } from '../components'
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
            <AutocompletePopover />
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
            <AutocompletePopover />
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

const misspelledContent = `
<h1>Spell Check Test</h1>
<p>This paragraph contains some misspeled words to demonstrate the spell check feature.</p>
<p>The folowing words are intentionally misspelled: teh, recieve, occured, seperate, definately.</p>
<p>When spell check is enabled, these words should be underlined with a red wavy line by the browser.</p>
`.trim()

function SpellCheckEnabledEditor(): React.ReactNode {
  const { containerRef, editor, ready, error } = useEditor({
    initialContent: misspelledContent,
    spellCheck: true,
  })

  return (
    <div style={{ padding: 20 }}>
      <div style={{ marginBottom: 10, color: '#666' }}>
        <strong>Spell Check: Enabled</strong> - Misspelled words should be underlined
      </div>
      {error && <div style={{ color: 'red', padding: 16 }}>Error: {error.message}</div>}
      <EditorContainer>
        {ready && editor ? (
          <EditorProvider context={editor.context}>
            <Toolbar />
            <AutocompletePopover />
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

function SpellCheckDisabledEditor(): React.ReactNode {
  const { containerRef, editor, ready, error } = useEditor({
    initialContent: misspelledContent,
    spellCheck: false,
  })

  return (
    <div style={{ padding: 20 }}>
      <div style={{ marginBottom: 10, color: '#666' }}>
        <strong>Spell Check: Disabled</strong> - No spell check underlining
      </div>
      {error && <div style={{ color: 'red', padding: 16 }}>Error: {error.message}</div>}
      <EditorContainer>
        {ready && editor ? (
          <EditorProvider context={editor.context}>
            <Toolbar />
            <AutocompletePopover />
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

export const SpellCheckEnabled: Story = {
  render: () => <SpellCheckEnabledEditor />,
  parameters: {
    docs: {
      description: {
        story: 'Editor with browser spell check enabled. Misspelled words are underlined with red wavy lines.',
      },
    },
  },
}

export const SpellCheckDisabled: Story = {
  render: () => <SpellCheckDisabledEditor />,
  parameters: {
    docs: {
      description: {
        story: 'Editor with browser spell check disabled. No spell check underlining is shown.',
      },
    },
  },
}

const autocompleteContent = `
<h1>Autocomplete Test</h1>
<p>This editor demonstrates the word autocomplete feature.</p>
<p>The autocomplete plugin tracks words you type and suggests completions based on existing content.</p>
<p>Try typing words like "auto", "demon", "compl", "feat" to see suggestions appear.</p>
<p>Use arrow keys to navigate suggestions and Enter/Tab to select.</p>
`.trim()

function AutocompleteTestEditor(): React.ReactNode {
  const { containerRef, editor, ready, error } = useEditor({
    initialContent: autocompleteContent,
  })

  return (
    <div style={{ padding: 20 }}>
      <div style={{ marginBottom: 10, color: '#666' }}>
        <strong>Autocomplete</strong> - Type 2+ characters to see suggestions from existing words
      </div>
      {error && <div style={{ color: 'red', padding: 16 }}>Error: {error.message}</div>}
      <EditorContainer>
        {ready && editor ? (
          <EditorProvider context={editor.context}>
            <Toolbar />
            <AutocompletePopover />
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

export const AutocompleteTest: Story = {
  render: () => <AutocompleteTestEditor />,
  parameters: {
    docs: {
      description: {
        story: 'Editor with word autocomplete. Start typing a word that exists in the document (2+ characters) and suggestions will appear. Use arrow keys to navigate and Enter/Tab to select.',
      },
    },
  },
}

function MobileViewEditor(): React.ReactNode {
  const { containerRef, editor, ready, error } = useEditor({
    initialContent: '<p>Resize the viewport to see responsive toolbar behavior.</p><p>On mobile (< 768px), the toolbar adapts with larger touch targets and a "More" menu for overflow items.</p>',
  })

  return (
    <div style={{ padding: 20, maxWidth: 375 }}>
      <div style={{ marginBottom: 10, color: '#666' }}>
        <strong>Mobile View</strong> - Simulated 375px width (iPhone)
      </div>
      {error && <div style={{ color: 'red', padding: 16 }}>Error: {error.message}</div>}
      <EditorContainer>
        {ready && editor ? (
          <EditorProvider context={editor.context}>
            <Toolbar />
            <AutocompletePopover />
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

function TabletViewEditor(): React.ReactNode {
  const { containerRef, editor, ready, error } = useEditor({
    initialContent: '<p>This is a tablet view simulation (768px width).</p><p>The toolbar shows most items but hides some advanced options in the More menu.</p>',
  })

  return (
    <div style={{ padding: 20, maxWidth: 768 }}>
      <div style={{ marginBottom: 10, color: '#666' }}>
        <strong>Tablet View</strong> - Simulated 768px width (iPad)
      </div>
      {error && <div style={{ color: 'red', padding: 16 }}>Error: {error.message}</div>}
      <EditorContainer>
        {ready && editor ? (
          <EditorProvider context={editor.context}>
            <Toolbar />
            <AutocompletePopover />
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

export const MobileView: Story = {
  render: () => <MobileViewEditor />,
  parameters: {
    viewport: {
      defaultViewport: 'mobile1',
    },
    docs: {
      description: {
        story: 'Editor optimized for mobile devices. Toolbar items are larger for touch targets and less-used features are moved to the More menu.',
      },
    },
  },
}

export const TabletView: Story = {
  render: () => <TabletViewEditor />,
  parameters: {
    viewport: {
      defaultViewport: 'tablet',
    },
    docs: {
      description: {
        story: 'Editor view for tablet-sized screens. Some toolbar features are hidden and accessible via the More menu.',
      },
    },
  },
}

const tableContent = `
<h1>Table Resize Test</h1>
<p>The table below can be resized by dragging the column borders.</p>
<table>
  <tbody>
    <tr>
      <td>Column 1</td>
      <td>Column 2</td>
      <td>Column 3</td>
    </tr>
    <tr>
      <td>Data A1</td>
      <td>Data B1 - This cell has more content to demonstrate resizing</td>
      <td>Data C1</td>
    </tr>
    <tr>
      <td>Data A2</td>
      <td>Data B2</td>
      <td>Data C2 - Another cell with longer text content</td>
    </tr>
  </tbody>
</table>
<p>Hover over the border between columns to see the resize cursor, then drag to resize.</p>
`.trim()

function TableResizeTestEditor(): React.ReactNode {
  const { containerRef, editor, ready, error } = useEditor({
    initialContent: tableContent,
  })

  return (
    <div style={{ padding: 20 }}>
      <div style={{ marginBottom: 10, color: '#666' }}>
        <strong>Table Resize</strong> - Drag column borders to resize
      </div>
      {error && <div style={{ color: 'red', padding: 16 }}>Error: {error.message}</div>}
      <EditorContainer>
        {ready && editor ? (
          <EditorProvider context={editor.context}>
            <Toolbar />
            <AutocompletePopover />
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

export const TableResizeTest: Story = {
  render: () => <TableResizeTestEditor />,
  parameters: {
    docs: {
      description: {
        story: 'Editor with table column resize functionality. Hover over column borders to see the resize cursor, then drag to adjust column widths.',
      },
    },
  },
}

const autoSaveContent = `
<h1>Auto Save Test</h1>
<p>This editor has auto-save enabled with localStorage persistence.</p>
<p>Start typing and watch the status indicator in the top-right corner:</p>
<ul>
  <li><strong>Unsaved changes</strong> - Content has changed since last save</li>
  <li><strong>Saving...</strong> - Currently saving to localStorage</li>
  <li><strong>Saved at HH:MM</strong> - Content successfully saved</li>
</ul>
<p>Try editing this content and refresh the page - your changes will be restored!</p>
`.trim()

function AutoSaveTestEditor(): React.ReactNode {
  const { containerRef, editor, ready, error } = useEditor({
    initialContent: autoSaveContent,
    autoSave: {
      storageKey: 'sagak-editor-storybook-test',
      debounceMs: 1000,
      restoreOnInit: true,
    },
  })

  return (
    <div style={{ padding: 20 }}>
      <div style={{ marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ color: '#666' }}>
          <strong>Auto Save</strong> - Edit content to see save status
        </span>
        {ready && editor && (
          <EditorProvider context={editor.context}>
            <AutoSaveIndicator showTime />
          </EditorProvider>
        )}
      </div>
      {error && <div style={{ color: 'red', padding: 16 }}>Error: {error.message}</div>}
      <EditorContainer>
        {ready && editor ? (
          <EditorProvider context={editor.context}>
            <Toolbar />
            <AutocompletePopover />
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

export const AutoSaveTest: Story = {
  render: () => <AutoSaveTestEditor />,
  parameters: {
    docs: {
      description: {
        story: 'Editor with auto-save functionality. Content is automatically saved to localStorage after a short debounce period. The status indicator shows the current save state.',
      },
    },
  },
}
