export { createEditor } from './create-editor'
export type { CreateEditorOptions, Editor } from './create-editor'

export { EditorCore, AppStatus } from './core/editor-core'
export type { EditorCoreConfig, AppStatusValue } from './core/editor-core'
export { EventBus } from './core/event-bus'
export type { EventPhase, EventHandler, Unsubscribe } from './core/event-bus'
export { PluginManager } from './core/plugin-manager'
export { SelectionManager } from './core/selection-manager'
export { logger, setLogLevel, getLogLevel } from './core/logger'
export type { LogLevel, Logger } from './core/logger'
export { createErrorReporter } from './core/errors'
export type { EditorErrorData, ErrorReporter } from './core/errors'
export { CommandRegistry, runCommand } from './core/command-registry'
export type {
  CommandContext,
  CommandHandler,
  CommandStateQuery,
  CommandValueQuery,
} from './core/command-registry'
export {
  registerDefaultCommands,
  createDefaultCommandRegistry,
} from './core/default-commands'
export {
  registerNativeAlignment,
  NATIVE_PRECEDENCE,
} from './core/commands/native-alignment'
export { registerNativeFormatBlock } from './core/commands/native-format-block'
export { registerNativeInlineToggles } from './core/commands/native-inline-toggles'
export { registerNativeInlineStyles } from './core/commands/native-inline-styles'
export { registerNativeList } from './core/commands/native-list'
export {
  registerNativeFontSize,
  legacyFontSizeToCss,
  cssToLegacyFontSize,
} from './core/commands/native-font-size'
export { registerNativeQueries } from './core/commands/native-query'
export {
  insertHTMLAtSelection,
  insertTextAtSelection,
} from './core/commands/range-insert'
export {
  toggleList,
  shiftIndent,
  toggleListForBlocks,
  shiftIndentForBlocks,
  INDENT_STEP,
} from './core/commands/list-format'
export type { ListType } from './core/commands/list-format'
export {
  applyInlineStyle,
  applyLink,
  removeLink,
  applyInlineStyleInRange,
  applyLinkInRange,
  removeLinkInRange,
} from './core/commands/inline-style'
export type { InlineStyleProp } from './core/commands/inline-style'
export {
  toggleInlineFormat,
  toggleFormatInRange,
  INLINE_FORMATS,
} from './core/commands/inline-format'
export type { InlineFormat } from './core/commands/inline-format'
export { HistoryManager } from './core/history-manager'
export type {
  HistoryState,
  HistoryManagerOptions,
} from './core/history-manager'
export {
  CoreEvents,
  TextStyleEvents,
  FontEvents,
  ParagraphEvents,
  ContentEvents,
  HistoryEvents,
  FindReplaceEvents,
  AutocompleteEvents,
  EditingAreaEvents,
  WysiwygEvents,
  EditorEvents,
} from './core/events'
export type {
  EditorEventName,
  CoreEventName,
  PluginEventName,
} from './core/events'

export { definePlugin } from './core/define-plugin'
export type {
  PluginDefinition,
  PluginFactory,
  PluginHandlerContext,
  PluginInitContext,
  PluginEventHandlers,
  BasePluginOptions,
} from './core/define-plugin'

export type {
  Plugin,
  EditorContext,
  EditorConfig,
  EditingMode,
  EditingArea,
  EditingAreaManager,
  FormattingState,
} from './core/types'

export {
  createSanitizer,
  resolveSanitizer,
  identitySanitizer,
} from './editor/editing-area/sanitizer'
export type {
  Sanitizer,
  SanitizerOptions,
  SanitizeOption,
} from './editor/editing-area/sanitizer'

export { createBoldPlugin } from './plugins/bold-plugin'
export { createItalicPlugin } from './plugins/italic-plugin'
export { createUnderlinePlugin } from './plugins/underline-plugin'
export { createStrikePlugin } from './plugins/strike-plugin'
export { createSubscriptPlugin } from './plugins/subscript-plugin'
export { createSuperscriptPlugin } from './plugins/superscript-plugin'
export { createFontFamilyPlugin } from './plugins/font-family-plugin'
export { createFontSizePlugin } from './plugins/font-size-plugin'
export { createTextColorPlugin } from './plugins/text-color-plugin'
export { createBackgroundColorPlugin } from './plugins/background-color-plugin'
export { createHeadingPlugin } from './plugins/heading-plugin'
export { createParagraphPlugin } from './plugins/paragraph-plugin'
export { createAlignmentPlugin } from './plugins/alignment-plugin'
export { createOrderedListPlugin } from './plugins/ordered-list-plugin'
export { createUnorderedListPlugin } from './plugins/unordered-list-plugin'
export { createIndentPlugin } from './plugins/indent-plugin'
export { createOutdentPlugin } from './plugins/outdent-plugin'
export { createLinkPlugin } from './plugins/link-plugin'
export { createTablePlugin } from './plugins/table-plugin'
export { createImagePlugin } from './plugins/image-plugin'
export { createFindReplacePlugin } from './plugins/find-replace-plugin'
export { createHistoryPlugin } from './plugins/history-plugin'
export { createAutocompletePlugin } from './plugins/autocomplete-plugin'
export type {
  AutocompleteSuggestion,
  AutocompletePluginOptions,
} from './plugins/autocomplete-plugin'
export { createTableResizePlugin } from './plugins/table-resize-plugin'
export type { TableResizePluginOptions } from './plugins/table-resize-plugin'
export {
  createAutoSavePlugin,
  AutoSaveEvents,
} from './plugins/auto-save-plugin'
export type {
  AutoSavePluginOptions,
  AutoSaveStatus,
  AutoSaveEventData,
} from './plugins/auto-save-plugin'
export {
  createImageResizePlugin,
  ImageResizeEvents,
} from './plugins/image-resize-plugin'
export type { ImageResizePluginOptions } from './plugins/image-resize-plugin'
export {
  createImageUploadPlugin,
  ImageUploadEvents,
} from './plugins/image-upload-plugin'
export type { ImageUploadPluginOptions } from './plugins/image-upload-plugin'
export {
  createExportPlugin,
  ExportEvents,
  htmlToMarkdown,
  htmlToText,
} from './plugins/export-plugin'
export type {
  ExportPluginOptions,
  ExportFormat,
  ExportDownloadData,
} from './plugins/export-plugin'
