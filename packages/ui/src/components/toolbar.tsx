import { useState } from 'preact/hooks'
import { ParagraphEvents } from '@sagak/core'
import { useEditorSignals } from '../hooks/use-editor-signals'
import { useHistoryState } from '../hooks/use-history-state'
import { ToolbarButton } from './toolbar-button'
import { FontFamilyDropdown } from './font-family-dropdown'
import { FontSizeDropdown } from './font-size-dropdown'
import { HeadingDropdown } from './heading-dropdown'
import { TextColorPicker } from './text-color-picker'
import { BackgroundColorPicker } from './background-color-picker'
import { LinkDialog } from './link-dialog'
import { ImageDialog } from './image-dialog'
import { TableDialog } from './table-dialog'
import { FindReplaceDialog } from './find-replace-dialog'

/**
 * 툴바 컴포넌트
 *
 * `EditorProvider` 내부에서 사용해야 합니다
 * Context API를 통해 자동으로 `EditorContext`를 가져옵니다
 *
 * @returns `Toolbar` 컴포넌트
 *
 * @example
 * ```tsx
 * <EditorProvider context={editor.getContext()}>
 *   <Toolbar />
 * </EditorProvider>
 * ```
 */
export function Toolbar() {
  const {
    isBold,
    isItalic,
    isUnderline,
    isStrikeThrough,
    isSubscript,
    isSuperscript,
    toggleBold,
    toggleItalic,
    toggleUnderline,
    toggleStrikeThrough,
    toggleSubscript,
    toggleSuperscript,
    editorContext,
  } = useEditorSignals()
  const { canUndo, canRedo, undo, redo } = useHistoryState()

  const [isLinkDialogOpen, setIsLinkDialogOpen] = useState(false)
  const [isImageDialogOpen, setIsImageDialogOpen] = useState(false)
  const [isTableDialogOpen, setIsTableDialogOpen] = useState(false)
  const [isFindReplaceDialogOpen, setIsFindReplaceDialogOpen] = useState(false)

  const alignLeft = () =>
    editorContext.eventBus.emit(ParagraphEvents.ALIGNMENT_CHANGED, {
      align: 'left',
    })
  const alignCenter = () =>
    editorContext.eventBus.emit(ParagraphEvents.ALIGNMENT_CHANGED, {
      align: 'center',
    })
  const alignRight = () =>
    editorContext.eventBus.emit(ParagraphEvents.ALIGNMENT_CHANGED, {
      align: 'right',
    })
  const alignJustify = () =>
    editorContext.eventBus.emit(ParagraphEvents.ALIGNMENT_CHANGED, {
      align: 'justify',
    })

  const toggleOrderedList = () =>
    editorContext.eventBus.emit(ParagraphEvents.ORDERED_LIST_CLICKED)
  const toggleUnorderedList = () =>
    editorContext.eventBus.emit(ParagraphEvents.UNORDERED_LIST_CLICKED)

  const indent = () =>
    editorContext.eventBus.emit(ParagraphEvents.INDENT_CLICKED)
  const outdent = () =>
    editorContext.eventBus.emit(ParagraphEvents.OUTDENT_CLICKED)

  return (
    <>
      <div data-scope="toolbar" data-part="root">
        <ToolbarButton onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)">
          ↶
        </ToolbarButton>

        <ToolbarButton onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Y)">
          ↷
        </ToolbarButton>

        <div data-part="separator" />

        <HeadingDropdown />
        <FontFamilyDropdown />
        <FontSizeDropdown />

        <div data-part="separator" />

        <ToolbarButton
          active={isBold.value}
          onClick={toggleBold}
          title="Bold (Ctrl+B)"
        >
          <strong>B</strong>
        </ToolbarButton>

        <ToolbarButton
          active={isItalic.value}
          onClick={toggleItalic}
          title="Italic (Ctrl+I)"
        >
          <em>I</em>
        </ToolbarButton>

        <ToolbarButton
          active={isUnderline.value}
          onClick={toggleUnderline}
          title="Underline (Ctrl+U)"
        >
          <u>U</u>
        </ToolbarButton>

        <ToolbarButton
          active={isStrikeThrough.value}
          onClick={toggleStrikeThrough}
          title="Strikethrough"
        >
          <s>S</s>
        </ToolbarButton>

        <ToolbarButton
          active={isSubscript.value}
          onClick={toggleSubscript}
          title="Subscript"
        >
          X<sub>2</sub>
        </ToolbarButton>

        <ToolbarButton
          active={isSuperscript.value}
          onClick={toggleSuperscript}
          title="Superscript"
        >
          X<sup>2</sup>
        </ToolbarButton>

        <div data-part="separator" />

        <TextColorPicker />
        <BackgroundColorPicker />

        <div data-part="separator" />

        <ToolbarButton onClick={alignLeft} title="Align Left">
          ◀
        </ToolbarButton>

        <ToolbarButton onClick={alignCenter} title="Align Center">
          ≡
        </ToolbarButton>

        <ToolbarButton onClick={alignRight} title="Align Right">
          ▶
        </ToolbarButton>

        <ToolbarButton onClick={alignJustify} title="Justify">
          ☰
        </ToolbarButton>

        <div data-part="separator" />

        <ToolbarButton onClick={toggleOrderedList} title="Ordered List">
          1.
        </ToolbarButton>

        <ToolbarButton onClick={toggleUnorderedList} title="Unordered List">
          •
        </ToolbarButton>

        <ToolbarButton onClick={outdent} title="Decrease Indent">
          ⇤
        </ToolbarButton>

        <ToolbarButton onClick={indent} title="Increase Indent">
          ⇥
        </ToolbarButton>

        <div data-part="separator" />

        <ToolbarButton
          onClick={() => setIsLinkDialogOpen(true)}
          title="Insert Link"
        >
          🔗
        </ToolbarButton>

        <ToolbarButton
          onClick={() => setIsImageDialogOpen(true)}
          title="Insert Image"
        >
          🖼️
        </ToolbarButton>

        <ToolbarButton
          onClick={() => setIsTableDialogOpen(true)}
          title="Insert Table"
        >
          📊
        </ToolbarButton>

        <div data-part="separator" />

        <ToolbarButton
          onClick={() => setIsFindReplaceDialogOpen(true)}
          title="Find & Replace (Ctrl+F)"
        >
          🔍
        </ToolbarButton>
      </div>

      <LinkDialog
        isOpen={isLinkDialogOpen}
        onClose={() => setIsLinkDialogOpen(false)}
      />
      <ImageDialog
        isOpen={isImageDialogOpen}
        onClose={() => setIsImageDialogOpen(false)}
      />
      <TableDialog
        isOpen={isTableDialogOpen}
        onClose={() => setIsTableDialogOpen(false)}
      />
      <FindReplaceDialog
        isOpen={isFindReplaceDialogOpen}
        onClose={() => setIsFindReplaceDialogOpen(false)}
      />
    </>
  )
}
