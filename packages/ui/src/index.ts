export { EditorProvider, useEditorContext } from './context/editor-context'
export type { EditorProviderProps } from './context/editor-context'

export {
  useEditor,
  useFormattingSignals,
  useFormattingCommands,
  useHistorySignals,
  useHistoryCommands,
  useFontState,
  useRecentColors,
  useAutoSave,
  useEditorError,
} from './hooks'
export type {
  UseEditorOptions,
  UseEditorReturn,
  FormattingSignals,
  FormattingCommands,
  HistorySignals,
  HistoryState,
  HistoryCommands,
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
  FontFamilySelect,
  FontSizeSelect,
  HeadingSelect,
  LinkDialog,
  ImageDialog,
  TableDialog,
  ColorPicker,
  AlignmentButtons,
  IndentButtons,
  ListButtons,
  FindReplaceDialog,
  HorizontalRuleButton,
  LineHeightSelect,
  LetterSpacingSelect,
  SpecialCharacterDialog,
  AutocompletePopover,
  MoreMenu,
  AutoSaveIndicator,
  ExportMenu,
  DocumentBar,
  DocumentDialog,
} from './components'
export type {
  EditingAreaProps,
  EditorContainerProps,
  ColorPickerProps,
  AutoSaveIndicatorProps,
  ExportMenuProps,
  DocumentBarProps,
  DocumentDialogProps,
} from './components'
