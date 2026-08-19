export { createEditor } from './create-editor'

/* 문서 모델 — `docs/prosemirror-migration.md` */
export { sagakSchema, createSagakSchema } from './model/schema'
export type { SchemaOptions } from './model/schema'
export { toJSON, fromJSON, toHtml, parseHtml } from './model/storage'

/**
 * 선택이 무엇 위에 있는지 묻는 자리 — **UI 가 DOM 을 안 걷어도 됩니다.**
 *
 * `docs/prosemirror-migration.md` 4단계입니다.
 */
export {
  subscribeToModel,
  historyDepthOf,
  selectionFacts,
  alignmentOf,
  listKindOf,
  isInTableOf,
  linkOf,
  imageOf,
  modelHandle,
  modelState,
  runModelCommand,
} from './model/bridge'
export type { ModelListener } from './model/bridge'
export type {
  Alignment,
  ListKind,
  LinkFacts,
  ImageFacts,
} from './model/selection'
export {
  commands,
  isMarkActive,
  markValue,
  blockAttr,
  setMarkValue,
  setBlockAttr,
} from './model/commands'
export type { Command } from './model/commands'
export { registerModelCommands, MODEL_PRECEDENCE } from './model/register'
export type { StateHandle } from './model/register'
export type { DocumentJSON } from './model/storage'
export type { CreateEditorOptions, Editor } from './create-editor'

export { EditorCore, AppStatus } from './core/editor-core'
export type { EditorCoreConfig, AppStatusValue } from './core/editor-core'
export { EventBus } from './core/event-bus'
export type { EventPhase, EventHandler, Unsubscribe } from './core/event-bus'
export type { EditorEventMap, KnownEventName, PayloadOf } from './core/event-map'
export { EVENT_KIND } from './core/event-map'
export type { EventKind, RequestEvent, NotifyEvent } from './core/event-map'
export { PluginManager } from './core/plugin-manager'
export {
  createDocumentStore,
  isDocumentStorageAvailable,
} from './core/document-store'
export type { DocumentStore, DocumentMeta } from './core/document-store'
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
export type { DefaultCommandsOptions } from './core/default-commands'
export type {
  CommandMap,
  CommandName,
  CommandArgs,
  StateQueryName,
  ValueQueryName,
} from './core/command-map'
export {
  CoreEvents,
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
  Highlighter,
  HighlightRange,
} from './core/types'

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
