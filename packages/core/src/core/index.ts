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
} from './command-registry'
export { registerLegacyExecCommands } from './legacy-exec-command'
export {
  registerDefaultCommands,
  createDefaultCommandRegistry,
} from './default-commands'
export {
  registerNativeAlignment,
  NATIVE_PRECEDENCE,
} from './commands/native-alignment'

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
