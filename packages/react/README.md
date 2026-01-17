# sagak-editor

A modern, feature-rich WYSIWYG editor for React.

## Features

- **Rich Text Editing**: Bold, italic, underline, strikethrough, subscript, superscript
- **Typography**: Font family, font size, text color, background color
- **Paragraph Formatting**: Headings (H1-H6), alignment, indentation
- **Lists**: Ordered and unordered lists
- **Media**: Images with upload, drag-drop, paste, and resize
- **Tables**: Create, edit, and resize columns
- **Links**: Insert and edit hyperlinks
- **Find & Replace**: Search and replace text
- **Special Characters**: Insert symbols and emojis
- **Export**: Download as HTML, Markdown, or plain text
- **Auto-save**: Automatic saving to localStorage
- **Accessibility**: Full keyboard navigation and screen reader support
- **Responsive**: Mobile and tablet optimized

## Installation

```bash
npm install sagak-editor sagak-core react react-dom
# or
pnpm add sagak-editor sagak-core react react-dom
# or
yarn add sagak-editor sagak-core react react-dom
```

## Quick Start

```tsx
import { useEditor, EditorProvider, Toolbar, EditorContainer } from 'sagak-editor'
import 'sagak-editor/styles'

function MyEditor() {
  const { containerRef, editor, ready } = useEditor({
    initialContent: '<p>Hello World</p>',
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
```

## With Auto-save

```tsx
import { useEditor, EditorProvider, Toolbar, EditorContainer, AutoSaveIndicator } from 'sagak-editor'
import 'sagak-editor/styles'

function MyEditor() {
  const { containerRef, editor, ready } = useEditor({
    initialContent: '<p>Hello World</p>',
    autoSave: {
      storageKey: 'my-editor-content',
      debounceMs: 1000,
      restoreOnInit: true,
    },
  })

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        {ready && editor && (
          <EditorProvider context={editor.context}>
            <AutoSaveIndicator showTime />
          </EditorProvider>
        )}
      </div>
      <EditorContainer>
        {ready && editor && (
          <EditorProvider context={editor.context}>
            <Toolbar />
          </EditorProvider>
        )}
        <div ref={containerRef} data-scope="editing-area" data-part="wysiwyg" />
      </EditorContainer>
    </div>
  )
}
```

## API Reference

### useEditor

Main hook for creating an editor instance.

```tsx
const { containerRef, editor, ready, error } = useEditor(options)
```

**Options:**

| Option | Type | Description |
|--------|------|-------------|
| `initialContent` | `string` | Initial HTML content |
| `spellCheck` | `boolean` | Enable browser spell check |
| `autoSave` | `object` | Auto-save configuration |
| `autoSave.storageKey` | `string` | localStorage key for saving |
| `autoSave.debounceMs` | `number` | Debounce delay in ms |
| `autoSave.restoreOnInit` | `boolean` | Restore saved content on init |

**Returns:**

| Property | Type | Description |
|----------|------|-------------|
| `containerRef` | `RefObject` | Ref to attach to editor container |
| `editor` | `Editor \| null` | Editor instance |
| `ready` | `boolean` | Whether editor is ready |
| `error` | `Error \| null` | Error if initialization failed |

### Components

| Component | Description |
|-----------|-------------|
| `EditorContainer` | Wrapper component with styling |
| `EditorProvider` | Context provider for editor |
| `Toolbar` | Complete toolbar with all controls |
| `AutoSaveIndicator` | Shows auto-save status |
| `AutocompletePopover` | Word autocomplete popup |

### Individual Toolbar Components

For custom toolbar layouts:

```tsx
import {
  FontFamilySelect,
  FontSizeSelect,
  HeadingSelect,
  ColorPicker,
  AlignmentButtons,
  ListButtons,
  LinkDialog,
  ImageDialog,
  TableDialog,
  FindReplaceDialog,
  ExportMenu,
} from 'sagak-editor'
```

### Hooks

| Hook | Description |
|------|-------------|
| `useFormattingState` | Get current text formatting state |
| `useHistoryState` | Get undo/redo state |
| `useFontState` | Get current font state |
| `useAutoSave` | Get auto-save state |

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl + B` | Bold |
| `Cmd/Ctrl + I` | Italic |
| `Cmd/Ctrl + U` | Underline |
| `Cmd/Ctrl + Z` | Undo |
| `Cmd/Ctrl + Shift + Z` | Redo |
| `Cmd/Ctrl + K` | Insert link |

## Styling

Import the default styles:

```tsx
import 'sagak-editor/styles'
// or
import 'sagak-editor/styles.css'
```

### CSS Custom Properties

Customize the editor appearance:

```css
[data-scope='toolbar'] {
  --toolbar-bg: #f9fafb;
  --toolbar-border: #d1d5db;
}

[data-scope='editing-area'] {
  --editor-font-family: system-ui, sans-serif;
  --editor-font-size: 16px;
  --editor-line-height: 1.6;
}
```

## TypeScript Support

Full TypeScript support with exported types:

```typescript
import type {
  UseEditorOptions,
  UseEditorReturn,
  EditorProviderProps,
  EditingAreaProps,
} from 'sagak-editor'
```

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## License

MIT
