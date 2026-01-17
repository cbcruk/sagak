import type { Meta, StoryObj } from '@storybook/react-vite'
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

const imageUploadContent = `
<h1>Image Upload & Resize Test</h1>
<p>This editor demonstrates image upload and resize functionality.</p>
<h2>Features:</h2>
<ul>
  <li><strong>File Upload</strong> - Click the image button and select "Upload" tab to upload images from your device</li>
  <li><strong>Drag & Drop</strong> - Drop images directly into the editor or the upload dialog</li>
  <li><strong>Paste Images</strong> - Paste images from clipboard (Ctrl/Cmd+V)</li>
  <li><strong>Resize</strong> - Click on any image to see resize handles, then drag corners to resize</li>
</ul>
<p>Try inserting an image below:</p>
`.trim()

function ImageUploadTestEditor(): React.ReactNode {
  const { containerRef, editor, ready, error } = useEditor({
    initialContent: imageUploadContent,
  })

  return (
    <div style={{ padding: 20 }}>
      <div style={{ marginBottom: 10, color: '#666' }}>
        <strong>Image Upload & Resize</strong> - Upload, drag-drop, paste, and resize images
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

export const ImageUploadTest: Story = {
  render: () => <ImageUploadTestEditor />,
  parameters: {
    docs: {
      description: {
        story: 'Editor with image upload, drag-drop, paste from clipboard, and resize functionality. Click the image button to see URL and Upload options. Click on an inserted image to see resize handles.',
      },
    },
  },
}

const exportContent = `
<h1>Export Test Document</h1>
<p>This editor demonstrates the <strong>export functionality</strong>.</p>
<h2>Supported Formats</h2>
<ul>
  <li><strong>HTML</strong> - Full formatting preserved</li>
  <li><strong>Markdown</strong> - Portable text format</li>
  <li><strong>Plain Text</strong> - No formatting</li>
</ul>
<p>Click the <em>download icon</em> in the toolbar to export this content.</p>
<h2>Sample Table</h2>
<table>
  <tr><th>Format</th><th>Extension</th></tr>
  <tr><td>HTML</td><td>.html</td></tr>
  <tr><td>Markdown</td><td>.md</td></tr>
  <tr><td>Text</td><td>.txt</td></tr>
</table>
<blockquote>This is a blockquote that will be converted to Markdown format.</blockquote>
`.trim()

function ExportTestEditor(): React.ReactNode {
  const { containerRef, editor, ready, error } = useEditor({
    initialContent: exportContent,
  })

  return (
    <div style={{ padding: 20 }}>
      <div style={{ marginBottom: 10, color: '#666' }}>
        <strong>Export</strong> - Click the download icon to export as HTML, Markdown, or Text
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

export const ExportTest: Story = {
  render: () => <ExportTestEditor />,
  parameters: {
    docs: {
      description: {
        story: 'Editor with export functionality. Click the download icon in the toolbar to export content as HTML, Markdown, or plain text. The Markdown converter handles headings, lists, tables, links, and inline formatting.',
      },
    },
  },
}

const accessibilityContent = `
<h1>Accessibility Test</h1>
<p>This editor includes accessibility improvements for keyboard and screen reader users.</p>
<h2>Keyboard Navigation</h2>
<ul>
  <li><strong>Tab</strong> - Move between toolbar buttons</li>
  <li><strong>Enter/Space</strong> - Activate buttons</li>
  <li><strong>Arrow keys</strong> - Navigate within menus</li>
  <li><strong>Escape</strong> - Close dialogs and menus</li>
</ul>
<h2>Screen Reader Support</h2>
<p>All toolbar buttons have <em>aria-label</em> attributes and proper role assignments.</p>
<p>Try using Tab to navigate through the toolbar and observe the focus indicators.</p>
`.trim()

function AccessibilityTestEditor(): React.ReactNode {
  const { containerRef, editor, ready, error } = useEditor({
    initialContent: accessibilityContent,
  })

  return (
    <div style={{ padding: 20 }}>
      <div style={{ marginBottom: 10, color: '#666' }}>
        <strong>Accessibility</strong> - Use Tab to navigate, observe focus indicators
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
          role="textbox"
          aria-multiline="true"
          aria-label="Editor content"
        />
      </EditorContainer>
    </div>
  )
}

export const AccessibilityTest: Story = {
  render: () => <AccessibilityTestEditor />,
  parameters: {
    docs: {
      description: {
        story: 'Editor with accessibility improvements. Includes focus-visible styles, ARIA attributes, keyboard navigation, high contrast mode support, and reduced motion support.',
      },
    },
  },
}

const fullDemoContent = `
<h1>Sagak Editor Demo</h1>
<p>Welcome to Sagak Editor - a modern, feature-rich WYSIWYG editor for React.</p>

<h2>Text Formatting</h2>
<p>This editor supports <strong>bold</strong>, <em>italic</em>, <u>underline</u>, and <s>strikethrough</s> text. You can also use <sub>subscript</sub> and <sup>superscript</sup>.</p>

<h2>Lists</h2>
<p>Ordered and unordered lists are fully supported:</p>
<ul>
  <li>Bullet point one</li>
  <li>Bullet point two</li>
  <li>Bullet point three</li>
</ul>
<ol>
  <li>First numbered item</li>
  <li>Second numbered item</li>
  <li>Third numbered item</li>
</ol>

<h2>Tables</h2>
<p>Create and edit tables with resizable columns:</p>
<table>
  <tr>
    <th>Feature</th>
    <th>Description</th>
    <th>Status</th>
  </tr>
  <tr>
    <td>Text Formatting</td>
    <td>Bold, italic, underline, etc.</td>
    <td>✓ Complete</td>
  </tr>
  <tr>
    <td>Tables</td>
    <td>Resizable columns</td>
    <td>✓ Complete</td>
  </tr>
  <tr>
    <td>Images</td>
    <td>Upload, resize, drag-drop</td>
    <td>✓ Complete</td>
  </tr>
</table>

<h2>More Features</h2>
<p>Try out all the features in the toolbar above:</p>
<ul>
  <li><strong>Undo/Redo</strong> - Full history support</li>
  <li><strong>Headings</strong> - H1 through H6</li>
  <li><strong>Colors</strong> - Text and background colors</li>
  <li><strong>Alignment</strong> - Left, center, right, justify</li>
  <li><strong>Links</strong> - Insert and edit hyperlinks</li>
  <li><strong>Images</strong> - URL or file upload</li>
  <li><strong>Find &amp; Replace</strong> - Search and replace text</li>
  <li><strong>Special Characters</strong> - Insert symbols</li>
  <li><strong>Export</strong> - Download as HTML, Markdown, or Text</li>
</ul>

<blockquote>
This editor auto-saves your content to localStorage. Look for the save indicator in the top-right corner!
</blockquote>

<hr />
<p style="text-align: center; color: #666;">Built with ❤️ using React and TypeScript</p>
`.trim()

function FullDemoEditor(): React.ReactNode {
  const { containerRef, editor, ready, error } = useEditor({
    initialContent: fullDemoContent,
    autoSave: {
      storageKey: 'sagak-editor-full-demo',
      debounceMs: 1500,
      restoreOnInit: true,
    },
  })

  return (
    <div style={{ padding: 20, maxWidth: 900, margin: '0 auto' }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
        paddingBottom: 16,
        borderBottom: '1px solid #e5e5e5',
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 600 }}>Sagak Editor</h1>
          <p style={{ margin: '4px 0 0', color: '#666', fontSize: 14 }}>
            A modern WYSIWYG editor for React
          </p>
        </div>
        {ready && editor && (
          <EditorProvider context={editor.context}>
            <AutoSaveIndicator showTime />
          </EditorProvider>
        )}
      </div>

      {error && (
        <div style={{
          color: '#dc3545',
          padding: 16,
          background: '#f8d7da',
          borderRadius: 8,
          marginBottom: 16,
        }}>
          Error: {error.message}
        </div>
      )}

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
          style={{ minHeight: 400 }}
          role="textbox"
          aria-multiline="true"
          aria-label="Editor content"
        />
      </EditorContainer>

      <div style={{
        marginTop: 24,
        padding: 16,
        background: '#f9fafb',
        borderRadius: 8,
        fontSize: 13,
        color: '#666',
      }}>
        <strong>Keyboard Shortcuts:</strong>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 8 }}>
          <span>⌘B - Bold</span>
          <span>⌘I - Italic</span>
          <span>⌘U - Underline</span>
          <span>⌘Z - Undo</span>
          <span>⌘⇧Z - Redo</span>
          <span>⌘K - Link</span>
        </div>
      </div>
    </div>
  )
}

export const FullDemo: Story = {
  render: () => <FullDemoEditor />,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        story: `
# Sagak Editor - Full Demo

This is a complete demonstration of all editor features:

## Features
- **Text Formatting**: Bold, italic, underline, strikethrough, subscript, superscript
- **Headings**: H1 through H6 with paragraph option
- **Lists**: Ordered and unordered lists
- **Tables**: Create, edit, and resize columns
- **Images**: Upload, drag-drop, paste, and resize
- **Links**: Insert and edit hyperlinks
- **Colors**: Text and background color pickers
- **Alignment**: Left, center, right, justify
- **Find & Replace**: Search and replace text
- **Special Characters**: Insert symbols and emojis
- **Export**: Download as HTML, Markdown, or plain text
- **Auto-save**: Automatic saving to localStorage
- **Accessibility**: Full keyboard navigation and screen reader support

## Usage

\`\`\`tsx
import { useEditor, EditorProvider, Toolbar, EditorContainer } from 'sagak-react'
import 'sagak-react/styles'

function MyEditor() {
  const { containerRef, editor, ready } = useEditor({
    initialContent: '<p>Hello World</p>',
    autoSave: { storageKey: 'my-editor', restoreOnInit: true },
  })

  return (
    <EditorContainer>
      {ready && editor && (
        <EditorProvider context={editor.context}>
          <Toolbar />
        </EditorProvider>
      )}
      <div ref={containerRef} data-scope="editing-area" data-part="wysiwyg" />
    </EditorContainer>
  )
}
\`\`\`
        `,
      },
    },
  },
}

const headingContent = `
<h1>Heading 1 - Main Title</h1>
<p>This is a paragraph under H1.</p>
<h2>Heading 2 - Section</h2>
<p>This is a paragraph under H2.</p>
<h3>Heading 3 - Subsection</h3>
<p>This is a paragraph under H3.</p>
<h4>Heading 4</h4>
<p>This is a paragraph under H4.</p>
<h5>Heading 5</h5>
<p>This is a paragraph under H5.</p>
<h6>Heading 6</h6>
<p>This is a paragraph under H6.</p>
`.trim()

function HeadingTestEditor(): React.ReactNode {
  const { containerRef, editor, ready, error } = useEditor({
    initialContent: headingContent,
  })

  return (
    <div style={{ padding: 20 }}>
      <div style={{ marginBottom: 10, color: '#666' }}>
        <strong>Heading Test</strong> - Select text and use the Heading dropdown to change levels
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

export const HeadingTest: Story = {
  render: () => <HeadingTestEditor />,
  parameters: {
    docs: {
      description: {
        story: 'Test heading levels (H1-H6). Select text and use the Heading dropdown to change between different heading levels and paragraph.',
      },
    },
  },
}

const linkContent = `
<h1>Link Test</h1>
<p>This paragraph contains a <a href="https://example.com">sample link</a> that you can edit.</p>
<p>Select text and click the Link button to add a new hyperlink.</p>
<p>Click on an existing link and use the Link button to edit or remove it.</p>
`.trim()

function LinkTestEditor(): React.ReactNode {
  const { containerRef, editor, ready, error } = useEditor({
    initialContent: linkContent,
  })

  return (
    <div style={{ padding: 20 }}>
      <div style={{ marginBottom: 10, color: '#666' }}>
        <strong>Link Test</strong> - Select text and click the Link button (or ⌘K)
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

export const LinkTest: Story = {
  render: () => <LinkTestEditor />,
  parameters: {
    docs: {
      description: {
        story: 'Test link insertion and editing. Select text and click the Link button to add hyperlinks. Click on existing links to edit them.',
      },
    },
  },
}

const findReplaceContent = `
<h1>Find and Replace Test</h1>
<p>This document contains the word "test" multiple times for testing the find and replace feature.</p>
<p>You can use the Find & Replace dialog to search for "test" and replace it with another word.</p>
<p>Try finding "test" - it should highlight all occurrences in the document.</p>
<p>The test feature also supports case-sensitive searching for more precise results.</p>
`.trim()

function FindReplaceTestEditor(): React.ReactNode {
  const { containerRef, editor, ready, error } = useEditor({
    initialContent: findReplaceContent,
  })

  return (
    <div style={{ padding: 20 }}>
      <div style={{ marginBottom: 10, color: '#666' }}>
        <strong>Find & Replace</strong> - Click the search icon to open the Find & Replace dialog
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

export const FindReplaceTest: Story = {
  render: () => <FindReplaceTestEditor />,
  parameters: {
    docs: {
      description: {
        story: 'Test the Find & Replace feature. Click the search icon in the toolbar to open the dialog. Search for "test" to see highlighting.',
      },
    },
  },
}

const listContent = `
<h1>List Test</h1>
<p>Below are examples of ordered and unordered lists:</p>
<h2>Unordered List (Bullets)</h2>
<ul>
  <li>First bullet item</li>
  <li>Second bullet item</li>
  <li>Third bullet item</li>
</ul>
<h2>Ordered List (Numbers)</h2>
<ol>
  <li>First numbered item</li>
  <li>Second numbered item</li>
  <li>Third numbered item</li>
</ol>
<p>Select text and click the list buttons to convert paragraphs to lists.</p>
`.trim()

function ListTestEditor(): React.ReactNode {
  const { containerRef, editor, ready, error } = useEditor({
    initialContent: listContent,
  })

  return (
    <div style={{ padding: 20 }}>
      <div style={{ marginBottom: 10, color: '#666' }}>
        <strong>List Test</strong> - Use the list buttons to create ordered and unordered lists
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

export const ListTest: Story = {
  render: () => <ListTestEditor />,
  parameters: {
    docs: {
      description: {
        story: 'Test ordered and unordered lists. Select text and use the list buttons to create bullet points or numbered lists.',
      },
    },
  },
}

const alignmentContent = `
<h1>Alignment Test</h1>
<p style="text-align: left;">This paragraph is aligned to the <strong>left</strong> (default).</p>
<p style="text-align: center;">This paragraph is aligned to the <strong>center</strong>.</p>
<p style="text-align: right;">This paragraph is aligned to the <strong>right</strong>.</p>
<p style="text-align: justify;">This paragraph is <strong>justified</strong>. Justified text stretches to fill the entire width of the container, creating even margins on both sides. This effect is more visible with longer text content.</p>
`.trim()

function AlignmentTestEditor(): React.ReactNode {
  const { containerRef, editor, ready, error } = useEditor({
    initialContent: alignmentContent,
  })

  return (
    <div style={{ padding: 20 }}>
      <div style={{ marginBottom: 10, color: '#666' }}>
        <strong>Alignment Test</strong> - Select text and use the alignment buttons
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

export const AlignmentTest: Story = {
  render: () => <AlignmentTestEditor />,
  parameters: {
    docs: {
      description: {
        story: 'Test text alignment (left, center, right, justify). Select a paragraph and click the alignment buttons to change its alignment.',
      },
    },
  },
}

const typographyContent = `
<h1>Typography Test</h1>
<p style="font-family: Georgia, serif;">This text uses <strong>Georgia</strong> font family.</p>
<p style="font-family: 'Courier New', monospace;">This text uses <strong>Courier New</strong> font family.</p>
<p style="font-size: 24px;">This text has a <strong>24px</strong> font size.</p>
<p style="font-size: 12px;">This text has a <strong>12px</strong> font size.</p>
<p style="line-height: 2;">This paragraph has <strong>double line spacing</strong>. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.</p>
<p style="letter-spacing: 2px;">This text has <strong>2px letter spacing</strong>.</p>
`.trim()

function TypographyTestEditor(): React.ReactNode {
  const { containerRef, editor, ready, error } = useEditor({
    initialContent: typographyContent,
  })

  return (
    <div style={{ padding: 20 }}>
      <div style={{ marginBottom: 10, color: '#666' }}>
        <strong>Typography Test</strong> - Test font family, size, line height, and letter spacing
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

export const TypographyTest: Story = {
  render: () => <TypographyTestEditor />,
  parameters: {
    docs: {
      description: {
        story: 'Test typography controls: font family, font size, line height, and letter spacing. Select text and use the dropdown menus in the toolbar.',
      },
    },
  },
}

const specialContent = `
<h1>Special Features Test</h1>
<p>This document demonstrates special text features.</p>
<h2>Subscript and Superscript</h2>
<p>Chemical formula: H<sub>2</sub>O (water)</p>
<p>Mathematical expression: x<sup>2</sup> + y<sup>2</sup> = z<sup>2</sup></p>
<h2>Horizontal Rule</h2>
<p>A horizontal rule separates sections:</p>
<hr />
<p>Content after the horizontal rule.</p>
<h2>Special Characters</h2>
<p>You can insert special characters like: © ® ™ € £ ¥ § ¶ • → ← ↑ ↓</p>
`.trim()

function SpecialFeaturesTestEditor(): React.ReactNode {
  const { containerRef, editor, ready, error } = useEditor({
    initialContent: specialContent,
  })

  return (
    <div style={{ padding: 20 }}>
      <div style={{ marginBottom: 10, color: '#666' }}>
        <strong>Special Features</strong> - Subscript, superscript, horizontal rule, special characters
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

export const SpecialFeaturesTest: Story = {
  render: () => <SpecialFeaturesTestEditor />,
  parameters: {
    docs: {
      description: {
        story: 'Test special features: subscript (x₂), superscript (x²), horizontal rule, and special character insertion. Access these from the More menu on mobile or directly in the toolbar.',
      },
    },
  },
}

const undoRedoContent = `
<h1>Undo/Redo Test</h1>
<p>This document is for testing the undo and redo functionality.</p>
<p>Try the following:</p>
<ol>
  <li>Make some changes to this text (add, delete, or format)</li>
  <li>Click the Undo button (or press ⌘Z) to revert changes</li>
  <li>Click the Redo button (or press ⌘⇧Z) to restore changes</li>
</ol>
<p>The undo/redo buttons will be disabled when there's nothing to undo or redo.</p>
`.trim()

function UndoRedoTestEditor(): React.ReactNode {
  const { containerRef, editor, ready, error } = useEditor({
    initialContent: undoRedoContent,
  })

  return (
    <div style={{ padding: 20 }}>
      <div style={{ marginBottom: 10, color: '#666' }}>
        <strong>Undo/Redo Test</strong> - Make changes and test the undo/redo buttons
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

export const UndoRedoTest: Story = {
  render: () => <UndoRedoTestEditor />,
  parameters: {
    docs: {
      description: {
        story: 'Test the undo/redo functionality. Make changes to the content and use the undo (⌘Z) and redo (⌘⇧Z) buttons or keyboard shortcuts.',
      },
    },
  },
}
