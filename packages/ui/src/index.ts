export { EditorProvider, useEditorContext } from './context/editor-context'
export type { EditorProviderProps } from './context/editor-context'

export {
  useEditor,
  useFontState,
  useRecentColors,
  useAutoSave,
  useEditorError,
} from './hooks'
export type {
  UseEditorOptions,
  UseEditorReturn,
  FontState,
  UseFontStateReturn,
  UseRecentColorsReturn,
  UseAutoSaveReturn,
  UseEditorErrorReturn,
} from './hooks'

export {
  EditingArea,
  EditorContainer,
  Toolbar,
  DocumentBar,
  AutocompletePopover,
} from './components'
export type {
  EditingAreaProps,
  EditorContainerProps,
  DocumentBarProps,
} from './components'
