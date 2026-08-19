export { EventBus } from './event-bus'
export type { EventPhase, EventHandler, Unsubscribe } from './event-bus'

export { PluginManager } from './plugin-manager'
export type { Plugin, EditorContext, EditorConfig } from './types'
export type { Highlighter, HighlightRange } from './types'

export { definePlugin } from './define-plugin'
export type {
  PluginDefinition,
  PluginFactory,
  PluginHandlerContext,
  PluginInitContext,
  BasePluginOptions,
} from './define-plugin'


/**
 * 브라우저 안의 파일 시스템(OPFS) 위에 놓인 문서 저장소 —
 * 레거시 텍스트 에디터의 뼈대입니다 (`docs/document-model.md`).
 */
export {
  createDocumentStore,
  isDocumentStorageAvailable,
} from './document-store'

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
export {
  registerDefaultCommands,
  createDefaultCommandRegistry,
} from './default-commands'

export { EditorCore, AppStatus } from './editor-core'
export type { EditorCoreConfig } from './editor-core'

export {
  CoreEvents,
  FindReplaceEvents,
  AutocompleteEvents,
  EditingAreaEvents,
  WysiwygEvents,
  EditorEvents,
} from './events'
export type { EditorEventName, CoreEventName, PluginEventName } from './events'
