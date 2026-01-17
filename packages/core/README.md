# sagak-core

Core library for Sagak Editor - a modern WYSIWYG editor.

## Installation

```bash
npm install sagak-core
# or
pnpm add sagak-core
# or
yarn add sagak-core
```

## Overview

`sagak-core` provides the foundational building blocks for the Sagak Editor:

- **EditorCore**: Main editor engine with plugin system
- **EventBus**: Event-driven architecture for editor communication
- **PluginManager**: Extensible plugin system
- **SelectionManager**: Text selection and cursor management
- **HistoryManager**: Undo/Redo functionality

## Basic Usage

```typescript
import { createEditor } from 'sagak-core'

const editor = createEditor({
  container: document.getElementById('editor'),
  initialContent: '<p>Hello World</p>',
})

// Access the editing area
const content = editor.getContent()

// Execute commands
editor.context.eventBus.emit('BOLD_TOGGLE')
```

## Available Plugins

The core package includes these built-in plugins:

### Text Formatting
- `createBoldPlugin` - Bold text
- `createItalicPlugin` - Italic text
- `createUnderlinePlugin` - Underline text
- `createStrikePlugin` - Strikethrough text
- `createSubscriptPlugin` - Subscript
- `createSuperscriptPlugin` - Superscript

### Font Styling
- `createFontFamilyPlugin` - Font family selection
- `createFontSizePlugin` - Font size control
- `createTextColorPlugin` - Text color
- `createBackgroundColorPlugin` - Background color

### Paragraph Formatting
- `createHeadingPlugin` - H1-H6 headings
- `createParagraphPlugin` - Paragraph blocks
- `createAlignmentPlugin` - Text alignment
- `createIndentPlugin` - Indent content
- `createOutdentPlugin` - Outdent content

### Lists
- `createOrderedListPlugin` - Numbered lists
- `createUnorderedListPlugin` - Bullet lists

### Media & Links
- `createLinkPlugin` - Hyperlinks
- `createImagePlugin` - Image insertion
- `createTablePlugin` - Tables

### Advanced Features
- `createHistoryPlugin` - Undo/Redo
- `createFindReplacePlugin` - Find and replace
- `createAutocompletePlugin` - Word autocomplete
- `createAutoSavePlugin` - Auto-save functionality
- `createExportPlugin` - Export to HTML/Markdown/Text
- `createImageResizePlugin` - Image resizing
- `createImageUploadPlugin` - Image upload
- `createTableResizePlugin` - Table column resizing

## Creating Custom Plugins

```typescript
import { definePlugin } from 'sagak-core'

const myPlugin = definePlugin({
  name: 'my-plugin',
  init(context) {
    // Plugin initialization
    context.eventBus.on('MY_CUSTOM_EVENT', (data) => {
      // Handle event
    })
  },
  destroy() {
    // Cleanup
  },
})
```

## Events

The editor uses an event-driven architecture. Common events:

```typescript
// Text formatting
'BOLD_TOGGLE', 'ITALIC_TOGGLE', 'UNDERLINE_TOGGLE', 'STRIKE_TOGGLE'

// Font styling
'FONT_FAMILY_APPLY', 'FONT_SIZE_APPLY', 'TEXT_COLOR_APPLY', 'BACKGROUND_COLOR_APPLY'

// Paragraph
'HEADING_APPLY', 'ALIGNMENT_APPLY'

// Lists
'ORDERED_LIST_TOGGLE', 'UNORDERED_LIST_TOGGLE'

// History
'HISTORY_UNDO', 'HISTORY_REDO'

// Content
'CONTENT_CHANGED', 'SELECTION_CHANGED'
```

## TypeScript Support

Full TypeScript support with exported types:

```typescript
import type {
  Editor,
  EditorContext,
  Plugin,
  PluginDefinition,
  EditingMode,
  FormattingState,
} from 'sagak-core'
```

## License

MIT
