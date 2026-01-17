import { EditorCore } from './core/editor-core'
import type { EditorContext, Plugin, EditingMode } from './core/types'

import { createBoldPlugin } from './plugins/bold-plugin'
import { createItalicPlugin } from './plugins/italic-plugin'
import { createUnderlinePlugin } from './plugins/underline-plugin'
import { createStrikePlugin } from './plugins/strike-plugin'
import { createSubscriptPlugin } from './plugins/subscript-plugin'
import { createSuperscriptPlugin } from './plugins/superscript-plugin'
import { createFontFamilyPlugin } from './plugins/font-family-plugin'
import { createFontSizePlugin } from './plugins/font-size-plugin'
import { createTextColorPlugin } from './plugins/text-color-plugin'
import { createBackgroundColorPlugin } from './plugins/background-color-plugin'
import { createHeadingPlugin } from './plugins/heading-plugin'
import { createParagraphPlugin } from './plugins/paragraph-plugin'
import { createAlignmentPlugin } from './plugins/alignment-plugin'
import { createOrderedListPlugin } from './plugins/ordered-list-plugin'
import { createUnorderedListPlugin } from './plugins/unordered-list-plugin'
import { createIndentPlugin } from './plugins/indent-plugin'
import { createOutdentPlugin } from './plugins/outdent-plugin'
import { createLinkPlugin } from './plugins/link-plugin'
import { createTablePlugin } from './plugins/table-plugin'
import { createImagePlugin } from './plugins/image-plugin'
import { createFindReplacePlugin } from './plugins/find-replace-plugin'
import { createHistoryPlugin } from './plugins/history-plugin'
import { createKeyboardShortcutsPlugin } from './plugins/keyboard-shortcuts-plugin'
import { createHorizontalRulePlugin } from './plugins/horizontal-rule-plugin'
import { createLineHeightPlugin } from './plugins/line-height-plugin'
import { createLetterSpacingPlugin } from './plugins/letter-spacing-plugin'

/**
 * Default plugins included in the editor
 */
const defaultPlugins: Plugin[] = [
  createBoldPlugin(),
  createItalicPlugin(),
  createUnderlinePlugin(),
  createStrikePlugin(),
  createSubscriptPlugin(),
  createSuperscriptPlugin(),
  createFontFamilyPlugin(),
  createFontSizePlugin(),
  createTextColorPlugin(),
  createBackgroundColorPlugin(),
  createHeadingPlugin(),
  createParagraphPlugin(),
  createAlignmentPlugin(),
  createOrderedListPlugin(),
  createUnorderedListPlugin(),
  createIndentPlugin(),
  createOutdentPlugin(),
  createLinkPlugin(),
  createTablePlugin(),
  createImagePlugin(),
  createFindReplacePlugin(),
  createHistoryPlugin(),
  createKeyboardShortcutsPlugin(),
  createHorizontalRulePlugin(),
  createLineHeightPlugin(),
  createLetterSpacingPlugin(),
]

/**
 * Editor configuration options
 */
export interface CreateEditorOptions {
  /**
   * Container element for the editing area
   */
  container: HTMLElement

  /**
   * Initial editing mode (default: 'wysiwyg')
   */
  initialMode?: EditingMode

  /**
   * Initial HTML content
   */
  initialContent?: string

  /**
   * Minimum height of the editing area
   */
  minHeight?: number

  /**
   * Enable auto-resize
   */
  autoResize?: boolean

  /**
   * Additional plugins to include
   */
  plugins?: Plugin[]

  /**
   * Replace default plugins entirely
   */
  replaceDefaultPlugins?: boolean
}

/**
 * Editor instance returned by createEditor
 */
export interface Editor {
  /**
   * Editor context for EditorProvider
   */
  context: EditorContext

  /**
   * Initialize and run the editor
   */
  run: () => Promise<void>

  /**
   * Get current content
   */
  getContent: () => Promise<string>

  /**
   * Set content
   */
  setContent: (content: string) => Promise<void>

  /**
   * Switch editing mode
   */
  switchMode: (mode: EditingMode) => Promise<void>

  /**
   * Get current editing mode
   */
  getCurrentMode: () => EditingMode | undefined

  /**
   * Focus the editor
   */
  focus: () => void

  /**
   * Execute an event/command
   */
  exec: (event: string, ...args: unknown[]) => boolean
}

/**
 * Create a new editor instance
 *
 * @example
 * ```tsx
 * const editor = createEditor({
 *   container: document.getElementById('editor')!,
 *   initialContent: '<p>Hello World</p>',
 * })
 *
 * await editor.run()
 *
 * render(
 *   <EditorProvider context={editor.context}>
 *     <Toolbar />
 *     <EditingArea />
 *   </EditorProvider>,
 *   document.getElementById('app')!
 * )
 * ```
 */
export function createEditor(options: CreateEditorOptions): Editor {
  const {
    container,
    initialMode = 'wysiwyg',
    initialContent,
    minHeight,
    autoResize,
    plugins = [],
    replaceDefaultPlugins = false,
  } = options

  const allPlugins = replaceDefaultPlugins
    ? plugins
    : [...defaultPlugins, ...plugins]

  const core = new EditorCore({
    editingAreaContainer: container,
    initialMode,
    minHeight,
    autoResize,
    plugins: allPlugins,
  })

  const editor: Editor = {
    context: core.getContext(),

    async run() {
      await core.run()
      if (initialContent) {
        await core.setContent(initialContent)
      }
    },

    getContent: () => core.getContent(),
    setContent: (content) => core.setContent(content),
    switchMode: (mode) => core.switchMode(mode),
    getCurrentMode: () => core.getCurrentMode(),
    focus: () => core.focus(),
    exec: (event, ...args) => core.exec(event, ...args),
  }

  return editor
}
