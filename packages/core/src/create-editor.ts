import type { DocumentJSON } from '@/model/storage'
import { EditorCore } from './core/editor-core'
import type { EditorContext, Plugin, EditingMode } from './core/types'
import type { LogLevel } from './core/logger'
import type { EditorErrorData } from './core/errors'

import { createFindReplacePlugin } from './plugins/find-replace-plugin'
import { createKeyboardShortcutsPlugin } from './plugins/keyboard-shortcuts-plugin'
import { createAutocompletePlugin } from './plugins/autocomplete-plugin'
import { createTableResizePlugin } from './plugins/table-resize-plugin'
import { createImageResizePlugin } from './plugins/image-resize-plugin'
import { createImageUploadPlugin } from './plugins/image-upload-plugin'
import { createExportPlugin } from './plugins/export-plugin'
import {
  createAutoSavePlugin,
  type AutoSavePluginOptions,
} from './plugins/auto-save-plugin'

/**
 * Default plugins included in the editor
 */
const defaultPlugins: Plugin[] = [
  createFindReplacePlugin(),
  createKeyboardShortcutsPlugin(),
  createAutocompletePlugin(),
  createTableResizePlugin(),
  createImageResizePlugin(),
  createImageUploadPlugin(),
  createExportPlugin(),
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
   * Enable spell check (default: true)
   */
  spellCheck?: boolean

  /**
   * Library log level (default: 'warn'); use 'silent' to suppress logs
   */
  logLevel?: LogLevel

  /**
   * Error callback, invoked when a plugin/core error is caught
   */
  onError?: (data: EditorErrorData) => void

  /**
   * Use the legacy execCommand fallback for undecidable cases
   * (default: true). Set to false to never call execCommand.
   */
  legacyFallback?: boolean

  /**
   * Additional plugins to include
   */
  plugins?: Plugin[]

  /**
   * Replace default plugins entirely
   */
  replaceDefaultPlugins?: boolean

  /**
   * Auto-save configuration (false to disable, true for defaults, or options object)
   */
  autoSave?: boolean | AutoSavePluginOptions
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

  /** 저장용 — 문서를 JSON 으로 (`docs/prosemirror-migration.md` §8) */
  getJSON: () => Promise<DocumentJSON>

  /** 저장물을 되돌립니다. 스키마 밖이면 던집니다 */
  setJSON: (json: DocumentJSON) => Promise<void>

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

  /**
   * Tear down the editor, removing all listeners and plugins
   */
  destroy: () => void
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
    spellCheck,
    logLevel,
    onError,
    legacyFallback,
    plugins = [],
    replaceDefaultPlugins = false,
    autoSave = false,
  } = options

  const allPlugins = replaceDefaultPlugins
    ? plugins
    : [...defaultPlugins, ...plugins]

  if (autoSave) {
    const autoSaveOptions =
      typeof autoSave === 'object' ? autoSave : undefined
    allPlugins.push(createAutoSavePlugin(autoSaveOptions))
  }

  const core = new EditorCore({
    editingAreaContainer: container,
    initialMode,
    minHeight,
    autoResize,
    spellCheck,
    logLevel,
    onError,
    legacyFallback,
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
    getJSON: () => core.getJSON(),
    setJSON: (json) => core.setJSON(json),
    setContent: (content) => core.setContent(content),
    switchMode: (mode) => core.switchMode(mode),
    getCurrentMode: () => core.getCurrentMode(),
    focus: () => core.focus(),
    exec: (event, ...args) => core.exec(event, ...args),
    destroy: () => core.destroy(),
  }

  return editor
}
