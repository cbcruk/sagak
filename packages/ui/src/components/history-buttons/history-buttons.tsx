import type { ComponentChildren } from 'preact'
import { Undo2, Redo2 } from 'lucide-preact'
import { useHistoryState } from '../../hooks'
import { ToolbarButton } from '../toolbar-button/toolbar-button'

const ICON_SIZE = 16

/** `format-toggles` 와 같은 이유로 `Toolbar` 에서 내려온 상태입니다 */
export function HistoryButtons(): ComponentChildren {
  const { canUndo, canRedo, undo, redo } = useHistoryState()

  return (
    <div data-part="icon-button-group" role="group" aria-label="History">
      <ToolbarButton
        title="Undo (⌘Z)"
        aria-label="Undo"
        onClick={undo}
        disabled={!canUndo}
      >
        <Undo2 size={ICON_SIZE} aria-hidden="true" />
      </ToolbarButton>
      <ToolbarButton
        title="Redo (⌘⇧Z)"
        aria-label="Redo"
        onClick={redo}
        disabled={!canRedo}
      >
        <Redo2 size={ICON_SIZE} aria-hidden="true" />
      </ToolbarButton>
    </div>
  )
}
