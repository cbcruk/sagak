export { EventBus } from './event-bus'
export type { EventPhase, EventHandler, Unsubscribe } from './event-bus'

export { PluginManager } from './plugin-manager'
export type { Plugin, EditorContext, EditorConfig } from './types'

export { definePlugin } from './define-plugin'
export type {
  PluginDefinition,
  PluginFactory,
  PluginHandlerContext,
  PluginInitContext,
  PluginEventHandlers,
  BasePluginOptions,
} from './define-plugin'

export { SelectionManager } from './selection-manager'

export { logger, setLogLevel, getLogLevel } from './logger'
export type { LogLevel, Logger } from './logger'

export { createErrorReporter } from './errors'
export type { EditorErrorData, ErrorReporter } from './errors'

export { CommandRegistry, runCommand } from './command-registry'
export type {
  CommandContext,
  CommandHandler,
  CommandStateQuery,
  CommandValueQuery,
} from './command-registry'
export { registerLegacyExecCommands } from './legacy-exec-command'
export {
  registerDefaultCommands,
  createDefaultCommandRegistry,
} from './default-commands'
export type { DefaultCommandsOptions } from './default-commands'
export {
  registerNativeAlignment,
  NATIVE_PRECEDENCE,
} from './commands/native-alignment'
export { registerNativeFormatBlock } from './commands/native-format-block'
export { registerNativeInlineToggles } from './commands/native-inline-toggles'
export { registerNativeInlineStyles } from './commands/native-inline-styles'
export { registerNativeList } from './commands/native-list'
export {
  registerNativeFontSize,
  legacyFontSizeToCss,
  cssToLegacyFontSize,
} from './commands/native-font-size'
export { registerNativeQueries } from './commands/native-query'
export {
  insertHTMLAtSelection,
  insertTextAtSelection,
} from './commands/range-insert'
export {
  installStoredMarks,
  togglePendingFormat,
  getPendingFormat,
  clearPendingFormats,
  hasPendingFormats,
  insertTextWithPendingFormats,
} from './commands/stored-marks'
export {
  toggleList,
  shiftIndent,
  toggleListForBlocks,
  shiftIndentForBlocks,
  INDENT_STEP,
} from './commands/list-format'
export type { ListType } from './commands/list-format'
export {
  applyInlineStyle,
  applyLink,
  removeLink,
  applyInlineStyleInRange,
  applyLinkInRange,
  removeLinkInRange,
} from './commands/inline-style'
export type { InlineStyleProp } from './commands/inline-style'
export {
  toggleInlineFormat,
  toggleFormatInRange,
  INLINE_FORMATS,
} from './commands/inline-format'
export type { InlineFormat } from './commands/inline-format'

export { HistoryManager } from './history-manager'
export type { HistoryState, HistoryManagerOptions } from './history-manager'

export { EditorCore, AppStatus } from './editor-core'
export type { EditorCoreConfig } from './editor-core'

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
} from './events'
export type { EditorEventName, CoreEventName, PluginEventName } from './events'
