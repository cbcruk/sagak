export { EditorProvider, useEditorContext } from './context/editor-context'
export type { EditorProviderProps } from './context/editor-context'

export { useEditor, useFormattingState, useHistoryState } from './hooks'
export type {
  UseEditorOptions,
  UseEditorReturn,
  FormattingActions,
  UseFormattingStateReturn,
  HistoryState,
  HistoryActions,
  UseHistoryStateReturn,
} from './hooks'

export { EditingArea } from './components'
export type { EditingAreaProps } from './components'
