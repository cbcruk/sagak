export { createEditor } from './create-editor'

/* 문서 모델 — `docs/prosemirror-migration.md` */
export { sagakSchema, createSagakSchema } from './model/schema'
export type { SchemaOptions } from './model/schema'
export { toJSON, fromJSON, toHtml, parseHtml } from './model/storage'

/** 찾기/바꾸기 — 이벤트 여섯이 아니라 객체 하나입니다 */
export { findReplace } from './features/find-replace'
export type {
  FindReplace,
  FindState,
  FindOptions,
} from './features/find-replace'

/** 자동 완성 — 이벤트 넷이 아니라 객체 하나입니다 */
export { autocomplete } from './features/autocomplete'
export type {
  Autocomplete,
  AutocompleteState,
  AutocompleteOptions,
} from './features/autocomplete'

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
/*
 * **`EventBus` 가 여기 있었습니다.**
 *
 * 마지막까지 남은 둘은 `EDITOR_ERROR`(코어가 쏘고 코어가 받아 `onError` 로
 * 넘김)와 `STYLE_CHANGED`(아무도 안 들음)였습니다. 오류는 `onError` 를 직접
 * 부르면 되고, 나머지는 §12 에서 전부 모듈 API 가 됐습니다.
 * (`docs/prosemirror-migration.md` §12-9)
 */
export { PluginManager } from './core/plugin-manager'
export {
  createDocumentStore,
  isDocumentStorageAvailable,
} from './core/document-store'
export type { DocumentStore, DocumentMeta } from './core/document-store'
export { logger, setLogLevel, getLogLevel } from './core/logger'
export type { LogLevel, Logger } from './core/logger'
export { createErrorReporter } from './core/errors'
export type { EditorErrorData, ErrorReporter, ErrorSink } from './core/errors'
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

export { createAutocompletePlugin } from './features/autocomplete'
export { createAutoSavePlugin, autoSave } from './features/auto-save'
export type {
  AutoSave,
  AutoSaveOptions,
  AutoSaveState,
  AutoSaveStatus,
} from './features/auto-save'
export { createImageResizePlugin } from './features/image-resize'
export type { ImageResizeOptions } from './features/image-resize'
export {
  createImageUploadPlugin,
  imageUpload,
  ALLOWED_IMAGE_TYPES,
  MAX_IMAGE_SIZE,
} from './features/image-upload'
export type {
  ImageUpload,
  ImageUploadOptions,
  ImageReadResult,
} from './features/image-upload'
export { exporter, htmlToMarkdown, htmlToText } from './features/export'
export type { Exporter, ExportFormat, ExportOptions } from './features/export'
