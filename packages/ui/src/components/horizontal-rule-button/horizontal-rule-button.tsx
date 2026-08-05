import type { ReactNode } from 'preact/compat'
import { Minus } from 'lucide-preact'
import { ContentEvents } from 'sagak-core'
import { useEditorContext } from '../../context/editor-context'
import { ToolbarButton } from '../toolbar-button/toolbar-button'

const ICON_SIZE = 16

export function HorizontalRuleButton(): ReactNode {
  const { eventBus } = useEditorContext()

  return (
    <ToolbarButton
      title="Insert Horizontal Rule"
      onClick={() => eventBus.emit(ContentEvents.HORIZONTAL_RULE_INSERT)}
    >
      <Minus size={ICON_SIZE} aria-hidden="true" />
    </ToolbarButton>
  )
}
