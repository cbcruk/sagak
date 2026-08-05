import type { ComponentChildren } from 'preact'
import { IndentDecrease, IndentIncrease } from 'lucide-preact'
import { ParagraphEvents } from 'sagak-core'
import { useEditorContext } from '../../context/editor-context'
import { ToolbarButton } from '../toolbar-button/toolbar-button'

const ICON_SIZE = 18

export function IndentButtons(): ComponentChildren {
  const { eventBus } = useEditorContext()

  return (
    <div data-part="icon-button-group" role="group" aria-label="Indentation">
      <ToolbarButton
        title="Decrease Indent"
        onClick={() => eventBus.emit(ParagraphEvents.OUTDENT_CLICKED)}
      >
        <IndentDecrease size={ICON_SIZE} aria-hidden="true" />
      </ToolbarButton>
      <ToolbarButton
        title="Increase Indent"
        onClick={() => eventBus.emit(ParagraphEvents.INDENT_CLICKED)}
      >
        <IndentIncrease size={ICON_SIZE} aria-hidden="true" />
      </ToolbarButton>
    </div>
  )
}
